import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaCommonSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaCommonSellingPricePriceStatusQueryService } from "../PrismaCommonSellingPricePriceStatusQueryService";

// CSPPS{01..04} = common-selling-price 単一商品 priceStatus 読みモデルのテスト用予約コード。
const CODES = {
  active: "CSPPS01",
  unset: "CSPPS02",
  futureOnly: "CSPPS03",
  expiredOnly: "CSPPS04",
} as const;

const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: { in: Object.values(CODES) } } });
}

async function makeProduct(
  code: string,
  name: string,
  category: ProductCategory = ProductCategory.INDIVIDUAL
): Promise<ProductId> {
  const product = await new PrismaProductRepository().insert(
    Product.create(
      new ProductCode(code),
      // products.name は @unique。他テストファイルとの並列実行衝突を code 接尾で防ぐ（#517）
      new ProductName(`${name}${code}`),
      category,
      ProductUnit.UNIT
    )
  );
  return product.id;
}

describe("PrismaCommonSellingPricePriceStatusQueryService", () => {
  let queryService: PrismaCommonSellingPricePriceStatusQueryService;
  let repository: PrismaCommonSellingPriceRepository;

  beforeEach(async () => {
    await cleanup();
    queryService = new PrismaCommonSellingPricePriceStatusQueryService();
    repository = new PrismaCommonSellingPriceRepository();
  });

  afterEach(cleanup);

  it("期間行が無い商品は priceStatus=unset（未設定）", async () => {
    await makeProduct(CODES.unset, "未設定商品");

    const status = await queryService.find({
      productCode: CODES.unset,
      referenceDate: "2025-06-15",
    });

    expect(status).toBe("unset");
  });

  it("参照日を覆う期間行がある商品は priceStatus=active", async () => {
    const productId = await makeProduct(CODES.active, "現在有効商品");
    const aggregate = CommonSellingPrice.create(productId, ProductCategory.INDIVIDUAL);
    aggregate.addPeriod(period("2025-01-01", null), price(1000), "2025-01-01");
    await repository.insert(aggregate);

    const status = await queryService.find({
      productCode: CODES.active,
      referenceDate: "2025-06-15",
    });

    expect(status).toBe("active");
  });

  it("将来行のみの商品は priceStatus=lapsed（失効中）", async () => {
    const productId = await makeProduct(CODES.futureOnly, "将来のみ商品");
    const aggregate = CommonSellingPrice.create(productId, ProductCategory.INDIVIDUAL);
    aggregate.addPeriod(period("2030-01-01", null), price(1000), "2025-01-01");
    await repository.insert(aggregate);

    const status = await queryService.find({
      productCode: CODES.futureOnly,
      referenceDate: "2025-06-15",
    });

    expect(status).toBe("lapsed");
  });

  it("失効行のみの商品は priceStatus=lapsed（失効中）", async () => {
    const productId = await makeProduct(CODES.expiredOnly, "失効のみ商品");
    const aggregate = CommonSellingPrice.create(productId, ProductCategory.INDIVIDUAL);
    aggregate.addPeriod(period("2025-01-01", "2025-03-01"), price(1000), "2025-01-01");
    await repository.insert(aggregate);

    const status = await queryService.find({
      productCode: CODES.expiredOnly,
      referenceDate: "2025-06-15",
    });

    expect(status).toBe("lapsed");
  });

  it("参照日が適用開始日と一致する日は active（半開区間の下端は包含）", async () => {
    const productId = await makeProduct(CODES.active, "開始日境界商品");
    const aggregate = CommonSellingPrice.create(productId, ProductCategory.INDIVIDUAL);
    aggregate.addPeriod(period("2025-06-15", "2025-12-31"), price(1000), "2025-01-01");
    await repository.insert(aggregate);

    const status = await queryService.find({
      productCode: CODES.active,
      referenceDate: "2025-06-15",
    });

    expect(status).toBe("active");
  });

  it("参照日が適用終了日と一致する日は lapsed（半開区間の上端は排他）", async () => {
    const productId = await makeProduct(CODES.expiredOnly, "終了日境界商品");
    const aggregate = CommonSellingPrice.create(productId, ProductCategory.INDIVIDUAL);
    aggregate.addPeriod(period("2025-01-01", "2025-06-15"), price(1000), "2025-01-01");
    await repository.insert(aggregate);

    const status = await queryService.find({
      productCode: CODES.expiredOnly,
      referenceDate: "2025-06-15",
    });

    expect(status).toBe("lapsed");
  });

  it("存在しない商品コードは null を返す（商品不在）", async () => {
    const status = await queryService.find({
      productCode: "CSPPS_NOT_EXIST",
      referenceDate: "2025-06-15",
    });

    expect(status).toBeNull();
  });
});
