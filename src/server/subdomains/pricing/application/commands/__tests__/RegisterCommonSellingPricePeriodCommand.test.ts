import prisma from "@server/prisma";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
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
import { RegisterCommonSellingPricePeriodCommand } from "../RegisterCommonSellingPricePeriodCommand";

const TEST_PRODUCT_CODE = "CSPCMD10";
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
}

describe("RegisterCommonSellingPricePeriodCommand", () => {
  let command: RegisterCommonSellingPricePeriodCommand;
  let repository: PrismaCommonSellingPriceRepository;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaCommonSellingPriceRepository();
    command = new RegisterCommonSellingPricePeriodCommand(repository);

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("登録コマンドテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(cleanup);

  it("未設定の商品に最初の期間を登録できる（新規 insert）", async () => {
    const result = await command.execute({
      productId: productId.value,
      start: "2030-01-01",
      end: null,
      price: "1000",
      referenceDate: "2025-06-01",
    });

    expect(result.periods).toHaveLength(1);
    const found = await repository.findByProductId(productId);
    expect(found!.periods).toHaveLength(1);
    expect(found!.periods[0].price.equals(price(1000))).toBe(true);
  });

  it("既存集約へ2本目の期間を追加できる（expectedVersion での update）", async () => {
    await command.execute({
      productId: productId.value,
      start: "2030-01-01",
      end: "2030-06-01",
      price: "1000",
      referenceDate: "2025-06-01",
    });

    await command.execute({
      productId: productId.value,
      start: "2030-06-01",
      end: null,
      price: "1200",
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByProductId(productId);
    expect(found!.periods).toHaveLength(2);
  });

  it("開始日が今日より前なら BusinessRuleViolationError（参照日が domain まで素通しされる）", async () => {
    await expect(
      command.execute({
        productId: productId.value,
        start: "2025-05-31",
        end: null,
        price: "1000",
        referenceDate: "2025-06-01",
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("既存集約への追加で expectedVersion が古いと ConflictError（expectedVersion が repo まで素通しされる）", async () => {
    await command.execute({
      productId: productId.value,
      start: "2030-01-01",
      end: "2030-06-01",
      price: "1000",
      referenceDate: "2025-06-01",
    });

    await expect(
      command.execute({
        productId: productId.value,
        start: "2030-06-01",
        end: null,
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 999,
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
