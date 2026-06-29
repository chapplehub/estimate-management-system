import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
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
import { PrismaCommonSellingPriceQueryService } from "../PrismaCommonSellingPriceQueryService";

// 実データ・他テストと衝突しない予約コード（CSPQS97x = common-selling-price QueryService 結合テスト）。
const TEST_PRODUCT_CODE = "CSPQS970";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  // products を消すと FK onDelete: Cascade で common_selling_prices と期間行も消える。
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
}

describe("PrismaCommonSellingPriceQueryService", () => {
  let queryService: PrismaCommonSellingPriceQueryService;
  let repository: PrismaCommonSellingPriceRepository;
  let productId: ProductId;

  beforeEach(async () => {
    queryService = new PrismaCommonSellingPriceQueryService();
    repository = new PrismaCommonSellingPriceRepository();
    await cleanup();

    // 共通販売単価は商品を親に持つ（FK 制約）。先に商品を作る。
    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("共通販売単価 時点解決テスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("区間内の暦日で有効な単価を引く", async () => {
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), "2025-07-01");
    await repository.insert(aggregate);

    const result = await queryService.resolve({ productId: productId.value, date: "2025-08-15" });

    expect(result).not.toBeNull();
    // selling_price は DECIMAL(12,2)。::text は銭2桁を伴う10進文字列で返る（消費側で Money.fromDecimalString が解釈）。
    expect(result?.sellingPrice).toBe("1000.00");
  });

  it("適用期間の開始日ちょうどは含む（半開 [) の下端）", async () => {
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), "2025-07-01");
    await repository.insert(aggregate);

    const result = await queryService.resolve({ productId: productId.value, date: "2025-07-01" });

    expect(result?.sellingPrice).toBe("1000.00");
  });

  it("適用期間の終了日ちょうどは含まない（半開 [) の上端）", async () => {
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), "2025-07-01");
    await repository.insert(aggregate);

    const result = await queryService.resolve({ productId: productId.value, date: "2025-10-01" });

    expect(result).toBeNull();
  });

  it("どの適用期間にも覆われない暦日では null を返す", async () => {
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), "2025-07-01");
    await repository.insert(aggregate);

    const result = await queryService.resolve({ productId: productId.value, date: "2025-06-30" });

    expect(result).toBeNull();
  });

  it("共通販売単価が1件も無い商品では null を返す", async () => {
    // 商品は存在するが期間行を1件も登録していない。「行が無い」と「覆う区間が無い」は区別しない。
    const result = await queryService.resolve({ productId: productId.value, date: "2025-08-15" });

    expect(result).toBeNull();
  });

  it("無期限上端（end=null）の期間は遠い未来の暦日でもヒットする", async () => {
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-10-01", null), price(1234.56), "2025-10-01");
    await repository.insert(aggregate);

    const result = await queryService.resolve({ productId: productId.value, date: "2099-12-31" });

    expect(result?.sellingPrice).toBe("1234.56");
  });
});
