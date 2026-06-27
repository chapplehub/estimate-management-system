import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { CostPrice } from "@subdomains/pricing/domain/entities";
import { CostUnitPrice } from "@subdomains/pricing/domain/values/CostUnitPrice";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaCostPriceRepository } from "../PrismaCostPriceRepository";

// 実データ・他テストと衝突しない予約コード（CPLK97x = cost-price 結合テスト）。
const TEST_PRODUCT_CODE = "CPLK970";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const cost = (yen: number) => CostUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  // products を消すと FK onDelete: Cascade で cost_prices と期間行も消える。
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
}

describe("PrismaCostPriceRepository", () => {
  let repository: PrismaCostPriceRepository;
  let productId: ProductId;

  beforeEach(async () => {
    repository = new PrismaCostPriceRepository();
    await cleanup();

    // 原価集約は商品を親に持つ（FK 制約）。先に商品を作る。
    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("原価テスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("未登録の商品では null を返す", async () => {
    expect(await repository.findByProductId(productId)).toBeNull();
  });

  it("insert して findByProductId で往復できる（有界＋無期限・銭精度）", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
    aggregate.addPeriod(period("2026-10-01", null), cost(1234.56));
    await repository.insert(aggregate);

    const found = await repository.findByProductId(productId);
    expect(found).not.toBeNull();
    const periods = found!.periods;
    expect(periods).toHaveLength(2);

    // lower(applicable_period) 昇順で返る
    expect(periods[0].period.equals(period("2026-04-01", "2026-10-01"))).toBe(true);
    expect(periods[0].price.equals(cost(600))).toBe(true);

    // 無期限の上端は end=null として往復する（番兵を使わない）
    expect(periods[1].period.equals(period("2026-10-01", null))).toBe(true);
    expect(periods[1].price.equals(cost(1234.56))).toBe(true);
  });

  it("0円の原価も往復できる（非複合品の本物の0）", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", null), cost(0));
    await repository.insert(aggregate);

    const found = (await repository.findByProductId(productId))!;
    expect(found.periods[0].price.equals(cost(0))).toBe(true);
  });

  it("update で期間行を追加同期できる（version 一致時・append-only）", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
    await repository.insert(aggregate);

    // 画面表示時の version=1 を持ち回って改定（期間を1本追加）
    const reloaded = (await repository.findByProductId(productId))!;
    reloaded.addPeriod(period("2026-10-01", null), cost(700));
    await repository.update(reloaded, 1);

    const found = (await repository.findByProductId(productId))!;
    expect(found.periods).toHaveLength(2);
    expect(found.periods[1].price.equals(cost(700))).toBe(true);
  });

  it("update は既存期間行の updated_at を変更しない（append-only・監査保持）", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
    await repository.insert(aggregate);

    // 既存行の updated_at を既知の過去値に固定し、偶発的な現在時刻一致を排除する。
    const frozen = new Date("2020-01-01T00:00:00.000Z");
    await prisma.$executeRaw`
      UPDATE cost_price_periods
      SET updated_at = ${frozen}
      WHERE product_id = ${productId.value}::uuid
    `;

    // version=1 を持ち回り、期間を1本追加して改定する。
    const reloaded = (await repository.findByProductId(productId))!;
    reloaded.addPeriod(period("2026-10-01", null), cost(700));
    await repository.update(reloaded, 1);

    const rows = await prisma.$queryRaw<{ updatedAt: Date; start: string }[]>`
      SELECT updated_at AS "updatedAt", lower(applicable_period)::text AS start
      FROM cost_price_periods
      WHERE product_id = ${productId.value}::uuid
      ORDER BY lower(applicable_period)
    `;

    expect(rows).toHaveLength(2);
    // 既存行（2026-04-01 始まり）の updated_at は固定した過去値のまま不変。
    expect(rows[0].updatedAt.toISOString()).toBe(frozen.toISOString());
    // 追加行（2026-10-01 始まり）は今回の挿入なので過去値ではない。
    expect(rows[1].updatedAt.getTime()).toBeGreaterThan(frozen.getTime());
  });

  it("古い expectedVersion での update は ConflictError", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", null), cost(600));
    await repository.insert(aggregate);

    await expect(repository.update(aggregate, 999)).rejects.toBeInstanceOf(ConflictError);
  });

  it("同一商品への二重 insert は ConflictError（親 PK 衝突の翻訳）", async () => {
    const first = CostPrice.create(productId);
    first.addPeriod(period("2026-04-01", null), cost(600));
    await repository.insert(first);

    // アプリ層の存在チェックをすり抜けた二重作成レースを模す。
    const second = CostPrice.create(productId);
    second.addPeriod(period("2026-04-01", null), cost(700));
    await expect(repository.insert(second)).rejects.toBeInstanceOf(ConflictError);
  });

  it("同一商品で適用期間が重複する行は EXCLUDE 制約で弾かれる", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
    await repository.insert(aggregate);

    // 並行 stale 書き込みを模して、ドメインのガードを迂回し重なる期間を直接 INSERT する。
    const insertOverlapping = prisma.$executeRaw`
      INSERT INTO cost_price_periods
        (id, product_id, cost_price, applicable_period, updated_at)
      VALUES (
        gen_random_uuid(),
        ${productId.value}::uuid,
        650::numeric,
        daterange('2026-09-01'::date, '2026-12-01'::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
    await expect(insertOverlapping).rejects.toThrow();
  });

  // 回帰: バックフィル移行が生成する期間行 id は UUIDv7 でなければ CostPricePeriodId VO に弾かれる。
  // gen_random_uuid()（v4）で投入すると findByProductId のロードで「不正なUUIDv7形式です」になるため、
  // 移行 SQL は pg_temp.gen_uuid_v7() で v7 を生成する。その生成式で直接 INSERT し、リポジトリ往復で
  // 読み出せること（VO 構築が throw しないこと）を固定する。
  it("バックフィル機構（v7生成）で投入した期間行をリポジトリでロードできる", async () => {
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION pg_temp.gen_uuid_v7() RETURNS uuid AS $$
        SELECT encode(
          set_bit(
            set_bit(
              overlay(uuid_send(gen_random_uuid())
                placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
                from 1 for 6),
              52, 1),
            53, 1), 'hex')::uuid;
      $$ LANGUAGE sql VOLATILE;
    `;
    await prisma.$executeRaw`
      INSERT INTO cost_prices (product_id, version, updated_at)
      VALUES (${productId.value}::uuid, 1, CURRENT_TIMESTAMP)
    `;
    await prisma.$executeRaw`
      INSERT INTO cost_price_periods
        (id, product_id, cost_price, applicable_period, updated_at)
      VALUES (
        pg_temp.gen_uuid_v7(),
        ${productId.value}::uuid,
        15000::numeric,
        daterange('2026-04-01'::date, NULL, '[)'),
        CURRENT_TIMESTAMP
      )
    `;

    const loaded = await repository.findByProductId(productId);

    expect(loaded).not.toBeNull();
    expect(loaded!.periods).toHaveLength(1);
    expect(loaded!.periods[0].price.equals(cost(15000))).toBe(true);
  });
});
