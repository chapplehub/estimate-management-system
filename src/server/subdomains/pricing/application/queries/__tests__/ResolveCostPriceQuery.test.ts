import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { CostPrice } from "@subdomains/pricing/domain/entities";
import { CostUnitPrice } from "@subdomains/pricing/domain/values/CostUnitPrice";
import { PrismaCostPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCostPriceRepository";
import { PrismaCostPriceQueryService } from "@subdomains/pricing/infrastructure/queries/PrismaCostPriceQueryService";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResolveCostPriceQuery } from "../ResolveCostPriceQuery";

// 実データ・他テストと衝突しない予約コード（CPQS97x = cost-price QueryService 結合テスト）。
const TEST_PRODUCT_CODE = "CPQS971";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const cost = (yen: number) => CostUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
}

describe("ResolveCostPriceQuery", () => {
  let query: ResolveCostPriceQuery;
  let repository: PrismaCostPriceRepository;
  let productId: ProductId;

  beforeEach(async () => {
    query = new ResolveCostPriceQuery(new PrismaCostPriceQueryService());
    repository = new PrismaCostPriceRepository();
    await cleanup();

    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("原価 時点解決ラッパテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("基準暦日に有効な原価を解決する", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
    await repository.insert(aggregate);

    const result = await query.execute({ productId: productId.value, date: "2026-08-15" });

    expect(result?.costPrice).toBe("600.00");
  });

  it("有効な原価が無ければ null を返す", async () => {
    const result = await query.execute({ productId: productId.value, date: "2026-08-15" });

    expect(result).toBeNull();
  });
});
