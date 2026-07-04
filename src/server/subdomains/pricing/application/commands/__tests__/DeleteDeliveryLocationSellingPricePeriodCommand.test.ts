import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import { DeliveryLocationSellingPrice } from "@subdomains/pricing/domain/entities";
import { DeliveryLocationSellingPricePeriodId } from "@subdomains/pricing/domain/values/DeliveryLocationSellingPricePeriodId";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaDeliveryLocationSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeleteDeliveryLocationSellingPricePeriodCommand } from "../DeleteDeliveryLocationSellingPricePeriodCommand";

const TEST_PRODUCT_CODE = "DLSPCMD40";
const TEST_DELIVERY_LOCATION_CODE = "DLSPCMD41";
const PARENT_CUSTOMER_CODE = "DLSPCMD42";
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
  await prisma.deliveryLocation.deleteMany({ where: { code: TEST_DELIVERY_LOCATION_CODE } });
  await prisma.customer.deleteMany({ where: { code: PARENT_CUSTOMER_CODE } });
}

describe("DeleteDeliveryLocationSellingPricePeriodCommand", () => {
  let command: DeleteDeliveryLocationSellingPricePeriodCommand;
  let repository: PrismaDeliveryLocationSellingPriceRepository;
  let deliveryLocationId: DeliveryLocationId;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaDeliveryLocationSellingPriceRepository();
    command = new DeleteDeliveryLocationSellingPricePeriodCommand(repository);

    const customer = await new PrismaCustomerRepository().insert(
      Customer.create(
        new CompanyCode(PARENT_CUSTOMER_CODE),
        new CompanyName("削除コマンドテスト親得意先")
      )
    );
    const deliveryLocation = await new PrismaDeliveryLocationRepository().insert(
      DeliveryLocation.create(
        new CompanyCode(TEST_DELIVERY_LOCATION_CODE),
        new CompanyName("削除コマンドテスト納品先"),
        customer.id
      )
    );
    deliveryLocationId = deliveryLocation.id;

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName(`削除コマンドテスト商品${TEST_PRODUCT_CODE}`),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(cleanup);

  it("将来行を削除できる", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(
      deliveryLocationId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    aggregate.addPeriod(period("2030-01-01", "2030-06-01"), price(1000), "2025-06-01");
    aggregate.addPeriod(period("2030-06-01", null), price(1200), "2025-06-01");
    await repository.insert(aggregate);
    const firstId = (await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    ))!.periods[0].id;

    await command.execute({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      periodId: firstId.value,
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    );
    expect(found!.periods).toHaveLength(1);
    expect(found!.periods[0].period.equals(period("2030-06-01", null))).toBe(true);
  });

  it("最後の1行を削除すると集約ごと消え、空シェルを残さない（#512・B案）", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(
      deliveryLocationId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    aggregate.addPeriod(period("2030-01-01", null), price(1000), "2025-06-01");
    await repository.insert(aggregate);
    const onlyId = (await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    ))!.periods[0].id;

    await command.execute({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      periodId: onlyId.value,
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    expect(
      await repository.findByDeliveryLocationIdAndProductId(deliveryLocationId, productId)
    ).toBeNull();
  });

  it("最後の1行を削除した後、同一の納品先×商品へ version 1 で再登録できる（再登録経路の回帰・#512）", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(
      deliveryLocationId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    aggregate.addPeriod(period("2030-01-01", null), price(1000), "2025-06-01");
    await repository.insert(aggregate);
    const onlyId = (await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    ))!.periods[0].id;
    await command.execute({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      periodId: onlyId.value,
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const reregister = DeliveryLocationSellingPrice.create(
      deliveryLocationId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    reregister.addPeriod(period("2030-02-01", null), price(2000), "2025-06-01");
    await repository.insert(reregister);
    const found = (await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    ))!;
    expect(found.periods).toHaveLength(1);
    expect(found.periods[0].price.equals(price(2000))).toBe(true);
  });

  it("集約が無い納品先×商品では NotFoundEntityError", async () => {
    await expect(
      command.execute({
        deliveryLocationId: deliveryLocationId.value,
        productId: productId.value,
        periodId: DeliveryLocationSellingPricePeriodId.generate().value,
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(NotFoundEntityError);
  });

  it("現在有効行の削除は BusinessRuleViolationError（参照日が domain まで素通しされる）", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(
      deliveryLocationId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");
    await repository.insert(aggregate);
    const periodId = (await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    ))!.periods[0].id;

    await expect(
      command.execute({
        deliveryLocationId: deliveryLocationId.value,
        productId: productId.value,
        periodId: periodId.value,
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("expectedVersion が古いと ConflictError", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(
      deliveryLocationId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    aggregate.addPeriod(period("2030-01-01", null), price(1000), "2025-06-01");
    await repository.insert(aggregate);
    const periodId = (await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    ))!.periods[0].id;

    await expect(
      command.execute({
        deliveryLocationId: deliveryLocationId.value,
        productId: productId.value,
        periodId: periodId.value,
        referenceDate: "2025-06-01",
        expectedVersion: 999,
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
