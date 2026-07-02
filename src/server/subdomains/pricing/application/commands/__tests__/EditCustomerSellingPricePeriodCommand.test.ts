import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { CustomerSellingPrice } from "@subdomains/pricing/domain/entities";
import { CustomerSellingPricePeriodId } from "@subdomains/pricing/domain/values/CustomerSellingPricePeriodId";
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
import { EditCustomerSellingPricePeriodCommand } from "../EditCustomerSellingPricePeriodCommand";

const TEST_PRODUCT_CODE = "CUSPCMD20";
const TEST_CUSTOMER_CODE = "CUSPCMD21";
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
  await prisma.customer.deleteMany({ where: { code: TEST_CUSTOMER_CODE } });
}

describe("EditCustomerSellingPricePeriodCommand", () => {
  let command: EditCustomerSellingPricePeriodCommand;
  let repository: PrismaCustomerSellingPriceRepository;
  let customerId: CustomerId;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaCustomerSellingPriceRepository();
    command = new EditCustomerSellingPricePeriodCommand(repository);

    const customer = await new PrismaCustomerRepository().insert(
      Customer.create(
        new CompanyCode(TEST_CUSTOMER_CODE),
        new CompanyName("編集コマンドテスト得意先")
      )
    );
    customerId = customer.id;

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("編集コマンドテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(cleanup);

  /** 将来行を1本持つ集約を用意し、その periodId を返す。 */
  async function seedFuturePeriod(): Promise<CustomerSellingPricePeriodId> {
    const aggregate = CustomerSellingPrice.create(customerId, productId);
    aggregate.addPeriod(period("2030-01-01", null), price(1000), "2025-06-01");
    await repository.insert(aggregate);
    return (await repository.findByCustomerIdAndProductId(customerId, productId))!.periods[0].id;
  }

  it("将来行の単価・期間を編集できる", async () => {
    const periodId = await seedFuturePeriod();

    await command.execute({
      customerId: customerId.value,
      productId: productId.value,
      periodId: periodId.value,
      start: "2030-02-01",
      end: null,
      price: "1500",
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByCustomerIdAndProductId(customerId, productId);
    expect(found!.periods[0].price.equals(price(1500))).toBe(true);
    expect(found!.periods[0].period.equals(period("2030-02-01", null))).toBe(true);
  });

  it("集約が無い得意先×商品では NotFoundEntityError", async () => {
    await expect(
      command.execute({
        customerId: customerId.value,
        productId: productId.value,
        periodId: CustomerSellingPricePeriodId.generate().value,
        start: "2030-02-01",
        end: null,
        price: "1500",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(NotFoundEntityError);
  });

  it("現在有効行の編集は BusinessRuleViolationError（参照日が domain まで素通しされる）", async () => {
    const aggregate = CustomerSellingPrice.create(customerId, productId);
    aggregate.addPeriod(period("2025-05-01", "2030-01-01"), price(1000), "2025-04-01");
    await repository.insert(aggregate);
    const periodId = (await repository.findByCustomerIdAndProductId(customerId, productId))!
      .periods[0].id;

    await expect(
      command.execute({
        customerId: customerId.value,
        productId: productId.value,
        periodId: periodId.value,
        start: "2030-02-01",
        end: null,
        price: "1500",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("expectedVersion が古いと ConflictError", async () => {
    const periodId = await seedFuturePeriod();

    await expect(
      command.execute({
        customerId: customerId.value,
        productId: productId.value,
        periodId: periodId.value,
        start: "2030-02-01",
        end: null,
        price: "1500",
        referenceDate: "2025-06-01",
        expectedVersion: 999,
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
