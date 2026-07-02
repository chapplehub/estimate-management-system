import prisma from "@server/prisma";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaCustomerSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCustomerSellingPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RegisterCustomerSellingPricePeriodCommand } from "../RegisterCustomerSellingPricePeriodCommand";

const TEST_PRODUCT_CODE = "CUSPCMD10";
const TEST_CUSTOMER_CODE = "CUSPCMD11";
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
  await prisma.customer.deleteMany({ where: { code: TEST_CUSTOMER_CODE } });
}

describe("RegisterCustomerSellingPricePeriodCommand", () => {
  let command: RegisterCustomerSellingPricePeriodCommand;
  let repository: PrismaCustomerSellingPriceRepository;
  let customerId: CustomerId;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaCustomerSellingPriceRepository();
    command = new RegisterCustomerSellingPricePeriodCommand(repository);

    const customer = await new PrismaCustomerRepository().insert(
      Customer.create(
        new CompanyCode(TEST_CUSTOMER_CODE),
        new CompanyName("登録コマンドテスト得意先")
      )
    );
    customerId = customer.id;

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName(`登録コマンドテスト商品${TEST_PRODUCT_CODE}`),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(cleanup);

  it("未設定の得意先×商品に最初の期間を登録できる（新規 insert）", async () => {
    const result = await command.execute({
      customerId: customerId.value,
      productId: productId.value,
      start: "2030-01-01",
      end: null,
      price: "1000",
      referenceDate: "2025-06-01",
    });

    expect(result.periods).toHaveLength(1);
    const found = await repository.findByCustomerIdAndProductId(customerId, productId);
    expect(found!.periods).toHaveLength(1);
    expect(found!.periods[0].price.equals(price(1000))).toBe(true);
  });

  it("既存集約へ2本目の期間を追加できる（expectedVersion での update）", async () => {
    await command.execute({
      customerId: customerId.value,
      productId: productId.value,
      start: "2030-01-01",
      end: "2030-06-01",
      price: "1000",
      referenceDate: "2025-06-01",
    });

    await command.execute({
      customerId: customerId.value,
      productId: productId.value,
      start: "2030-06-01",
      end: null,
      price: "1200",
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByCustomerIdAndProductId(customerId, productId);
    expect(found!.periods).toHaveLength(2);
  });

  it("開始日が今日より前なら BusinessRuleViolationError（参照日が domain まで素通しされる）", async () => {
    await expect(
      command.execute({
        customerId: customerId.value,
        productId: productId.value,
        start: "2025-05-31",
        end: null,
        price: "1000",
        referenceDate: "2025-06-01",
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("既存集約への追加で expectedVersion 未指定なら ValidationError（楽観ロック失敗ではなく入力契約違反）", async () => {
    await command.execute({
      customerId: customerId.value,
      productId: productId.value,
      start: "2030-01-01",
      end: "2030-06-01",
      price: "1000",
      referenceDate: "2025-06-01",
    });

    await expect(
      command.execute({
        customerId: customerId.value,
        productId: productId.value,
        start: "2030-06-01",
        end: null,
        price: "1200",
        referenceDate: "2025-06-01",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("既存集約への追加で expectedVersion が古いと ConflictError（expectedVersion が repo まで素通しされる）", async () => {
    await command.execute({
      customerId: customerId.value,
      productId: productId.value,
      start: "2030-01-01",
      end: "2030-06-01",
      price: "1000",
      referenceDate: "2025-06-01",
    });

    await expect(
      command.execute({
        customerId: customerId.value,
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
