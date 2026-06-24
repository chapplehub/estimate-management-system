import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import { DeliveryLocationSellingPrice } from "@subdomains/pricing/domain/entities";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaDeliveryLocationSellingPriceRepository } from "../PrismaDeliveryLocationSellingPriceRepository";

// 実データ・他テストと衝突しない予約コード（DLSP97x = delivery-location-selling-price 結合テスト）。
const TEST_PRODUCT_CODE = "DLSP970";
const TEST_DELIVERY_LOCATION_CODE = "DLSP971";
const PARENT_CUSTOMER_CODE = "DLSP972";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  // products を消すと FK onDelete: Cascade で delivery_location_selling_prices と期間行も消える。
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
  // delivery_locations を消すと同様に集約も消える。親得意先は最後に消す（FK 順序）。
  await prisma.deliveryLocation.deleteMany({ where: { code: TEST_DELIVERY_LOCATION_CODE } });
  await prisma.customer.deleteMany({ where: { code: PARENT_CUSTOMER_CODE } });
}

describe("PrismaDeliveryLocationSellingPriceRepository", () => {
  let repository: PrismaDeliveryLocationSellingPriceRepository;
  let deliveryLocationId: DeliveryLocationId;
  let productId: ProductId;

  beforeEach(async () => {
    repository = new PrismaDeliveryLocationSellingPriceRepository();
    await cleanup();

    // 納品先別販売単価は納品先 × 商品を親に持つ（FK 制約）。納品先はさらに得意先を親に持つ。
    const customerRepository = new PrismaCustomerRepository();
    const customer = await customerRepository.insert(
      Customer.create(
        new CompanyCode(PARENT_CUSTOMER_CODE),
        new CompanyName("納品先別単価テスト親得意先")
      )
    );

    const deliveryLocationRepository = new PrismaDeliveryLocationRepository();
    const deliveryLocation = await deliveryLocationRepository.insert(
      DeliveryLocation.create(
        new CompanyCode(TEST_DELIVERY_LOCATION_CODE),
        new CompanyName("納品先別単価テスト納品先"),
        customer.id
      )
    );
    deliveryLocationId = deliveryLocation.id;

    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("納品先別販売単価テスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("未登録の納品先×商品では null を返す", async () => {
    expect(
      await repository.findByDeliveryLocationIdAndProductId(deliveryLocationId, productId)
    ).toBeNull();
  });

  it("insert して findByDeliveryLocationIdAndProductId で往復できる（有界＋無期限・銭精度）", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    aggregate.addPeriod(period("2025-10-01", null), price(1234.56));
    await repository.insert(aggregate);

    const found = await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    );
    expect(found).not.toBeNull();
    const periods = found!.periods;
    expect(periods).toHaveLength(2);

    // lower(applicable_period) 昇順で返る
    expect(periods[0].period.equals(period("2025-07-01", "2025-10-01"))).toBe(true);
    expect(periods[0].price.equals(price(1000))).toBe(true);

    // 無期限の上端は end=null として往復する（番兵を使わない）
    expect(periods[1].period.equals(period("2025-10-01", null))).toBe(true);
    expect(periods[1].price.equals(price(1234.56))).toBe(true);
  });

  it("update で期間行を追加同期できる（version 一致時・append-only）", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    // 画面表示時の version=1 を持ち回って改定（期間を1本追加）
    const reloaded = (await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    ))!;
    reloaded.addPeriod(period("2025-10-01", null), price(1200));
    await repository.update(reloaded, 1);

    const found = (await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    ))!;
    expect(found.periods).toHaveLength(2);
    expect(found.periods[1].price.equals(price(1200))).toBe(true);
  });

  it("update は既存期間行の updated_at を変更しない（append-only・監査保持）", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    // 既存行の updated_at を既知の過去値に固定し、偶発的な現在時刻一致を排除する。
    const frozen = new Date("2020-01-01T00:00:00.000Z");
    await prisma.$executeRaw`
      UPDATE delivery_location_selling_price_periods
      SET updated_at = ${frozen}
      WHERE delivery_location_id = ${deliveryLocationId.value}::uuid AND product_id = ${productId.value}::uuid
    `;

    // version=1 を持ち回り、期間を1本追加して改定する。
    const reloaded = (await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    ))!;
    reloaded.addPeriod(period("2025-10-01", null), price(1200));
    await repository.update(reloaded, 1);

    const rows = await prisma.$queryRaw<{ updatedAt: Date; start: string }[]>`
      SELECT updated_at AS "updatedAt", lower(applicable_period)::text AS start
      FROM delivery_location_selling_price_periods
      WHERE delivery_location_id = ${deliveryLocationId.value}::uuid AND product_id = ${productId.value}::uuid
      ORDER BY lower(applicable_period)
    `;

    expect(rows).toHaveLength(2);
    // 既存行（2025-07-01 始まり）の updated_at は固定した過去値のまま不変。
    expect(rows[0].updatedAt.toISOString()).toBe(frozen.toISOString());
    // 追加行（2025-10-01 始まり）は今回の挿入なので過去値ではない。
    expect(rows[1].updatedAt.getTime()).toBeGreaterThan(frozen.getTime());
  });

  it("古い expectedVersion での update は ConflictError", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    aggregate.addPeriod(period("2025-07-01", null), price(1000));
    await repository.insert(aggregate);

    await expect(repository.update(aggregate, 999)).rejects.toBeInstanceOf(ConflictError);
  });

  it("同一の納品先×商品への二重 insert は ConflictError（親 複合PK 衝突の翻訳）", async () => {
    const first = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    first.addPeriod(period("2025-07-01", null), price(1000));
    await repository.insert(first);

    // アプリ層の存在チェックをすり抜けた二重作成レースを模す。
    const second = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    second.addPeriod(period("2025-07-01", null), price(2000));
    await expect(repository.insert(second)).rejects.toBeInstanceOf(ConflictError);
  });

  it("同一の納品先×商品で適用期間が重複する行は EXCLUDE 制約で弾かれる", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    // 並行 stale 書き込みを模して、ドメインのガードを迂回し重なる期間を直接 INSERT する。
    const insertOverlapping = prisma.$executeRaw`
      INSERT INTO delivery_location_selling_price_periods
        (id, delivery_location_id, product_id, selling_price, applicable_period, updated_at)
      VALUES (
        gen_random_uuid(),
        ${deliveryLocationId.value}::uuid,
        ${productId.value}::uuid,
        1100::numeric,
        daterange('2025-09-01'::date, '2025-12-01'::date, '[)'),
        CURRENT_TIMESTAMP
      )
    `;
    await expect(insertOverlapping).rejects.toThrow();
  });
});
