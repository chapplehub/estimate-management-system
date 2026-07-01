import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaCommonSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EndDateCommonSellingPricePeriodCommand } from "../EndDateCommonSellingPricePeriodCommand";
import { ReviseCommonSellingPricePeriodCommand } from "../ReviseCommonSellingPricePeriodCommand";

const TEST_PRODUCT_CODE = "CSPCMD31";
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
}

describe("ReviseCommonSellingPricePeriodCommand", () => {
  let command: ReviseCommonSellingPricePeriodCommand;
  let repository: PrismaCommonSellingPriceRepository;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaCommonSellingPriceRepository();
    command = new ReviseCommonSellingPricePeriodCommand(repository);

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("単価改定コマンドテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(cleanup);

  /** 現在有効な無期限行（2025-04-01〜・1000円）を1本持つ集約を用意する。 */
  async function seedActivePeriod(): Promise<void> {
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");
    await repository.insert(aggregate);
  }

  it("現在有効行を改定日で終了し、改定日開始の新行を連続して追加する", async () => {
    await seedActivePeriod();

    await command.execute({
      productId: productId.value,
      revisionDate: "2025-09-01",
      price: "1200",
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByProductId(productId);
    const rows = [...found!.periods].sort((a, b) => a.period.start.localeCompare(b.period.start));
    expect(rows).toHaveLength(2);
    // 旧行: 改定日で終了、単価据え置き
    expect(rows[0].period.equals(period("2025-04-01", "2025-09-01"))).toBe(true);
    expect(rows[0].price.equals(price(1000))).toBe(true);
    // 新行: 改定日開始の無期限、新単価
    expect(rows[1].period.equals(period("2025-09-01", null))).toBe(true);
    expect(rows[1].price.equals(price(1200))).toBe(true);
  });

  it("現在有効行が無い商品（将来行のみ）は BusinessRuleViolationError", async () => {
    // 集約は在るが現在有効行が無い（将来開始のみ）。loadOrThrow は通り改定対象が無いことで弾く。
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-12-01", null), price(1000), "2025-06-01");
    await repository.insert(aggregate);

    await expect(
      command.execute({
        productId: productId.value,
        revisionDate: "2026-01-01",
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("集約が無い商品（未設定）は NotFoundEntityError", async () => {
    await expect(
      command.execute({
        productId: productId.value,
        revisionDate: "2025-09-01",
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(NotFoundEntityError);
  });

  it("改定日が今日以前なら BusinessRuleViolationError（適用終了ガード由来・遡及改竄を閉じる）", async () => {
    await seedActivePeriod();

    await expect(
      command.execute({
        productId: productId.value,
        revisionDate: "2025-06-01", // = referenceDate（今日）。半開区間で今日を被覆外にする遡及短縮
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);

    // 失敗時は集約が変わらない（部分適用なし）
    const found = await repository.findByProductId(productId);
    expect(found!.periods).toHaveLength(1);
    expect(found!.periods[0].period.equals(period("2025-04-01", null))).toBe(true);
  });

  it("据え置き（新単価＝現単価）も改定として成立する（拒否しない）", async () => {
    await seedActivePeriod();

    await command.execute({
      productId: productId.value,
      revisionDate: "2025-09-01",
      price: "1000", // 現単価と同一
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByProductId(productId);
    const rows = [...found!.periods].sort((a, b) => a.period.start.localeCompare(b.period.start));
    expect(rows).toHaveLength(2);
    expect(rows[1].period.equals(period("2025-09-01", null))).toBe(true);
    expect(rows[1].price.equals(price(1000))).toBe(true);
  });

  it("expectedVersion が古いと ConflictError（部分適用なし）", async () => {
    await seedActivePeriod();

    await expect(
      command.execute({
        productId: productId.value,
        revisionDate: "2025-09-01",
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 999,
      })
    ).rejects.toBeInstanceOf(ConflictError);

    const found = await repository.findByProductId(productId);
    expect(found!.periods).toHaveLength(1);
  });

  it("改定日開始の新行が既存の将来行と重複すると BusinessRuleViolationError", async () => {
    // 現在有効行＋将来行（2025-10-01〜）。改定日2025-09-01開始の無期限新行が将来行と重なる。
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-04-01", "2025-10-01"), price(1000), "2025-03-01");
    aggregate.addPeriod(period("2025-10-01", null), price(1100), "2025-03-01");
    await repository.insert(aggregate);

    await expect(
      command.execute({
        productId: productId.value,
        revisionDate: "2025-09-01",
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);

    const found = await repository.findByProductId(productId);
    expect(found!.periods).toHaveLength(2);
  });

  it("version は改定1回につき1度だけ上がる（後続操作が expectedVersion=2 で通り 1 で弾かれる）", async () => {
    await seedActivePeriod();

    await command.execute({
      productId: productId.value,
      revisionDate: "2025-09-01",
      price: "1200",
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    // 改定後の現在有効行（2025-04-01〜2025-09-01）を後続の適用終了でプローブする。
    // 旧 version=1 では弾かれ（2重bumpしていないことの裏取り）、version=2 でのみ通る
    // （3になっていないことの裏取り）＝改定で version はちょうど1回だけ上がる。
    const endDate = new EndDateCommonSellingPricePeriodCommand(repository);
    const currentId = (await repository.findByProductId(productId))!.periods.find((r) =>
      r.period.contains("2025-06-01")
    )!.id.value;

    await expect(
      endDate.execute({
        productId: productId.value,
        periodId: currentId,
        endDate: "2025-08-01",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      endDate.execute({
        productId: productId.value,
        periodId: currentId,
        endDate: "2025-08-01",
        referenceDate: "2025-06-01",
        expectedVersion: 2,
      })
    ).resolves.toBeDefined();
  });
});
