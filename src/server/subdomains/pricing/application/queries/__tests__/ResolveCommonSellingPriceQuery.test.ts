import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaCommonSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository";
import { PrismaCommonSellingPriceQueryService } from "@subdomains/pricing/infrastructure/queries/PrismaCommonSellingPriceQueryService";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResolveCommonSellingPriceQuery } from "../ResolveCommonSellingPriceQuery";

// 実データ・他テストと衝突しない予約コード（CSPQS97x = common-selling-price QueryService 結合テスト）。
const TEST_PRODUCT_CODE = "CSPQS971";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
}

describe("ResolveCommonSellingPriceQuery", () => {
  let query: ResolveCommonSellingPriceQuery;
  let repository: PrismaCommonSellingPriceRepository;
  let productId: ProductId;

  beforeEach(async () => {
    query = new ResolveCommonSellingPriceQuery(new PrismaCommonSellingPriceQueryService());
    repository = new PrismaCommonSellingPriceRepository();
    await cleanup();

    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("共通販売単価 時点解決ラッパテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("基準暦日に有効な共通販売単価を解決する", async () => {
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await query.execute({ productId: productId.value, date: "2025-08-15" });

    expect(result?.sellingPrice).toBe("1000.00");
  });

  it("有効な単価が無ければ null を返す", async () => {
    const result = await query.execute({ productId: productId.value, date: "2025-08-15" });

    expect(result).toBeNull();
  });
});
