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
import { PrismaCommonSellingPriceListQueryService } from "../PrismaCommonSellingPriceListQueryService";

// CSPLST{01..04} = common-selling-price 一覧読みモデルのテスト用予約コード。
const CODES = {
  active: "CSPLST01",
  unset: "CSPLST02",
  futureOnly: "CSPLST03",
  expiredOnly: "CSPLST04",
} as const;

const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: { in: Object.values(CODES) } } });
}

async function makeProduct(code: string, name: string): Promise<ProductId> {
  const product = await new PrismaProductRepository().insert(
    Product.create(
      new ProductCode(code),
      new ProductName(name),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    )
  );
  return product.id;
}

describe("PrismaCommonSellingPriceListQueryService", () => {
  let queryService: PrismaCommonSellingPriceListQueryService;
  let repository: PrismaCommonSellingPriceRepository;

  beforeEach(async () => {
    await cleanup();
    queryService = new PrismaCommonSellingPriceListQueryService();
    repository = new PrismaCommonSellingPriceRepository();
  });

  afterEach(cleanup);

  it("現在有効な単価がある商品は現在有効単価を値で返す", async () => {
    const productId = await makeProduct(CODES.active, "現在有効商品");
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-01-01", null), price(1000), "2025-01-01");
    await repository.insert(aggregate);

    const items = await queryService.list({ referenceDate: "2025-06-15" });
    const item = items.find((i) => i.productCode === CODES.active);

    expect(item).toBeDefined();
    expect(item!.currentSellingPrice).toBe("1000.00");
  });

  it("期間行が無い商品（未設定）も母集合に含まれ currentSellingPrice は null", async () => {
    await makeProduct(CODES.unset, "未設定商品");

    const items = await queryService.list({ referenceDate: "2025-06-15" });
    const item = items.find((i) => i.productCode === CODES.unset);

    expect(item).toBeDefined();
    expect(item!.currentSellingPrice).toBeNull();
  });

  it("将来行のみの商品は現在有効が無く currentSellingPrice は null", async () => {
    const productId = await makeProduct(CODES.futureOnly, "将来のみ商品");
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2030-01-01", null), price(1000), "2025-01-01");
    await repository.insert(aggregate);

    const items = await queryService.list({ referenceDate: "2025-06-15" });
    const item = items.find((i) => i.productCode === CODES.futureOnly);

    expect(item!.currentSellingPrice).toBeNull();
  });

  it("失効行のみの商品は現在有効が無く currentSellingPrice は null", async () => {
    const productId = await makeProduct(CODES.expiredOnly, "失効のみ商品");
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-01-01", "2025-03-01"), price(1000), "2025-01-01");
    await repository.insert(aggregate);

    const items = await queryService.list({ referenceDate: "2025-06-15" });
    const item = items.find((i) => i.productCode === CODES.expiredOnly);

    expect(item!.currentSellingPrice).toBeNull();
  });
});
