import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { CostPrice } from "@subdomains/pricing/domain/entities";
import { CostUnitPrice } from "@subdomains/pricing/domain/values/CostUnitPrice";
import { PrismaCostPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCostPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaCostPriceEditQueryService } from "../PrismaCostPriceEditQueryService";

const TEST_PRODUCT_CODE = "CPEDT01";
const price = (yen: number) => CostUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
}

describe("PrismaCostPriceEditQueryService", () => {
  let queryService: PrismaCostPriceEditQueryService;
  let repository: PrismaCostPriceRepository;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    queryService = new PrismaCostPriceEditQueryService();
    repository = new PrismaCostPriceRepository();

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("編集読みモデルテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(cleanup);

  it("identity・version・期間行配列を返し、各行に時点状態（将来/現在有効/失効）を算出する", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2025-01-01", "2025-03-01"), price(800)); // 失効
    aggregate.addPeriod(period("2025-03-01", "2025-09-01"), price(1000)); // 現在有効
    aggregate.addPeriod(period("2030-01-01", null), price(1200)); // 将来
    await repository.insert(aggregate);

    const dto = await queryService.find({
      productCode: TEST_PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });

    expect(dto).not.toBeNull();
    expect(dto!.productId).toBe(productId.value);
    expect(dto!.productCode).toBe(TEST_PRODUCT_CODE);
    expect(dto!.productName).toBe("編集読みモデルテスト商品");
    expect(dto!.isActive).toBe(true);
    expect(dto!.version).toBe(1);

    // lower(applicable_period) 昇順
    expect(dto!.periods).toHaveLength(3);
    expect(dto!.periods.map((p) => p.status)).toEqual(["expired", "active", "future"]);

    const [expired, active, future] = dto!.periods;
    expect(expired.start).toBe("2025-01-01");
    expect(expired.end).toBe("2025-03-01");
    expect(expired.costPrice).toBe("800.00");
    expect(active.costPrice).toBe("1000.00");
    expect(future.end).toBeNull();
    expect(future.costPrice).toBe("1200.00");
  });

  it("商品は在るが集約が無い場合は identity＋version=null＋空 periods（新規登録モード）", async () => {
    const dto = await queryService.find({
      productCode: TEST_PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });

    expect(dto).not.toBeNull();
    expect(dto!.productId).toBe(productId.value);
    expect(dto!.productCode).toBe(TEST_PRODUCT_CODE);
    expect(dto!.productName).toBe("編集読みモデルテスト商品");
    expect(dto!.version).toBeNull();
    expect(dto!.periods).toEqual([]);
  });

  it("商品自体が存在しない場合は null（FE は notFound）", async () => {
    const dto = await queryService.find({
      productCode: "CPEDT99",
      referenceDate: "2025-06-15",
    });
    expect(dto).toBeNull();
  });

  it("update 後の version を反映する（楽観ロックトークン）", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2030-01-01", "2030-06-01"), price(1000));
    await repository.insert(aggregate);

    const reloaded = (await repository.findByProductId(productId))!;
    reloaded.addPeriod(period("2030-06-01", null), price(1200));
    await repository.update(reloaded, 1);

    const dto = await queryService.find({
      productCode: TEST_PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });
    expect(dto!.version).toBe(2);
  });
});
