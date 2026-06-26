import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import { DeliveryLocationSellingPrice } from "@subdomains/pricing/domain/entities";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaDeliveryLocationSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";
import { PrismaDeliveryLocationSellingPriceQueryService } from "@subdomains/pricing/infrastructure/queries/PrismaDeliveryLocationSellingPriceQueryService";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResolveDeliveryLocationSellingPriceQuery } from "../ResolveDeliveryLocationSellingPriceQuery";

// 実データ・他テストと衝突しない予約コード（DLSPQ8x = delivery-location-selling-price QueryService ラッパ結合テスト）。
const TEST_PRODUCT_CODE = "DLSPQ80";
const TEST_DELIVERY_LOCATION_CODE = "DLSPQ81";
const PARENT_CUSTOMER_CODE = "DLSPQ82";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
  await prisma.deliveryLocation.deleteMany({ where: { code: TEST_DELIVERY_LOCATION_CODE } });
  await prisma.customer.deleteMany({ where: { code: PARENT_CUSTOMER_CODE } });
}

describe("ResolveDeliveryLocationSellingPriceQuery", () => {
  let query: ResolveDeliveryLocationSellingPriceQuery;
  let repository: PrismaDeliveryLocationSellingPriceRepository;
  let deliveryLocationId: DeliveryLocationId;
  let productId: ProductId;

  beforeEach(async () => {
    query = new ResolveDeliveryLocationSellingPriceQuery(
      new PrismaDeliveryLocationSellingPriceQueryService()
    );
    repository = new PrismaDeliveryLocationSellingPriceRepository();
    await cleanup();

    const customerRepository = new PrismaCustomerRepository();
    const customer = await customerRepository.insert(
      Customer.create(
        new CompanyCode(PARENT_CUSTOMER_CODE),
        new CompanyName("納品先別単価ラッパテスト親得意先")
      )
    );

    const deliveryLocationRepository = new PrismaDeliveryLocationRepository();
    const deliveryLocation = await deliveryLocationRepository.insert(
      DeliveryLocation.create(
        new CompanyCode(TEST_DELIVERY_LOCATION_CODE),
        new CompanyName("納品先別単価ラッパテスト納品先"),
        customer.id
      )
    );
    deliveryLocationId = deliveryLocation.id;

    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("納品先別販売単価ラッパテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("基準暦日に有効な納品先別販売単価を解決する", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await query.execute({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      date: "2025-08-15",
    });

    expect(result?.sellingPrice).toBe("1000.00");
  });

  it("有効な単価が無ければ null を返す", async () => {
    const result = await query.execute({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      date: "2025-08-15",
    });

    expect(result).toBeNull();
  });
});
