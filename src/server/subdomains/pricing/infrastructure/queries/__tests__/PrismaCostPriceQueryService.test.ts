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
import { PrismaCostPriceQueryService } from "../PrismaCostPriceQueryService";

// 実データ・他テストと衝突しない予約コード（CPQS97x = cost-price QueryService 結合テスト）。
const TEST_PRODUCT_CODE = "CPQS970";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const cost = (yen: number) => CostUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  // products を消すと FK onDelete: Cascade で cost_prices と期間行も消える。
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
}

describe("PrismaCostPriceQueryService", () => {
  let queryService: PrismaCostPriceQueryService;
  let repository: PrismaCostPriceRepository;
  let productId: ProductId;

  beforeEach(async () => {
    queryService = new PrismaCostPriceQueryService();
    repository = new PrismaCostPriceRepository();
    await cleanup();

    // 原価集約は商品を親に持つ（FK 制約）。先に商品を作る。
    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("原価 時点解決テスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("区間内の暦日で有効な原価を引く", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
    await repository.insert(aggregate);

    const result = await queryService.resolve({ productId: productId.value, date: "2026-08-15" });

    expect(result).not.toBeNull();
    // cost_price は DECIMAL(12,2)。::text は銭2桁を伴う10進文字列で返る（消費側で Money.fromDecimalString が解釈）。
    expect(result?.costPrice).toBe("600.00");
  });

  it("適用期間の開始日ちょうどは含む（半開 [) の下端）", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
    await repository.insert(aggregate);

    const result = await queryService.resolve({ productId: productId.value, date: "2026-04-01" });

    expect(result?.costPrice).toBe("600.00");
  });

  it("適用期間の終了日ちょうどは含まない（半開 [) の上端）", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
    await repository.insert(aggregate);

    const result = await queryService.resolve({ productId: productId.value, date: "2026-10-01" });

    expect(result).toBeNull();
  });

  it("どの適用期間にも覆われない暦日では null を返す", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", "2026-10-01"), cost(600));
    await repository.insert(aggregate);

    const result = await queryService.resolve({ productId: productId.value, date: "2026-03-31" });

    expect(result).toBeNull();
  });

  it("原価が1件も無い商品では null を返す（期間なし＝原価未設定）", async () => {
    // 商品は存在するが期間行を1件も登録していない。「行が無い」と「覆う区間が無い」は区別しない。
    const result = await queryService.resolve({ productId: productId.value, date: "2026-08-15" });

    expect(result).toBeNull();
  });

  it("無期限上端（end=null）の期間は遠い未来の暦日でもヒットする", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2026-04-01", null), cost(1234.56));
    await repository.insert(aggregate);

    const result = await queryService.resolve({ productId: productId.value, date: "2099-12-31" });

    expect(result?.costPrice).toBe("1234.56");
  });
});
