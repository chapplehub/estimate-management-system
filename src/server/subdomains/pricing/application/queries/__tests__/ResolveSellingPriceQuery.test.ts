import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import {
  CommonSellingPrice,
  CustomerSellingPrice,
  DeliveryLocationSellingPrice,
} from "@subdomains/pricing/domain/entities";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaCommonSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository";
import { PrismaCustomerSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCustomerSellingPriceRepository";
import { PrismaDeliveryLocationSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";
import { PrismaCommonSellingPriceQueryService } from "@subdomains/pricing/infrastructure/queries/PrismaCommonSellingPriceQueryService";
import { PrismaCustomerSellingPriceQueryService } from "@subdomains/pricing/infrastructure/queries/PrismaCustomerSellingPriceQueryService";
import { PrismaDeliveryLocationSellingPriceQueryService } from "@subdomains/pricing/infrastructure/queries/PrismaDeliveryLocationSellingPriceQueryService";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResolveCommonSellingPriceQuery } from "../ResolveCommonSellingPriceQuery";
import { ResolveCustomerSellingPriceQuery } from "../ResolveCustomerSellingPriceQuery";
import { ResolveDeliveryLocationSellingPriceQuery } from "../ResolveDeliveryLocationSellingPriceQuery";
import { ResolveSellingPriceQuery } from "../ResolveSellingPriceQuery";

// 実データ・他テストと衝突しない予約コード（RSPQ8x = resolve-selling-price オーケストレーション結合テスト）。
const TEST_PRODUCT_CODE = "RSPQ80";
const TEST_CUSTOMER_CODE = "RSPQ81";
const TEST_DELIVERY_LOCATION_CODE = "RSPQ82";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
  await prisma.deliveryLocation.deleteMany({ where: { code: TEST_DELIVERY_LOCATION_CODE } });
  await prisma.customer.deleteMany({ where: { code: TEST_CUSTOMER_CODE } });
}

describe("ResolveSellingPriceQuery", () => {
  let query: ResolveSellingPriceQuery;
  let commonRepository: PrismaCommonSellingPriceRepository;
  let customerRepo: PrismaCustomerSellingPriceRepository;
  let deliveryLocationRepo: PrismaDeliveryLocationSellingPriceRepository;
  let customerId: CustomerId;
  let deliveryLocationId: DeliveryLocationId;
  let productId: ProductId;

  beforeEach(async () => {
    query = new ResolveSellingPriceQuery(
      new ResolveCommonSellingPriceQuery(new PrismaCommonSellingPriceQueryService()),
      new ResolveCustomerSellingPriceQuery(new PrismaCustomerSellingPriceQueryService()),
      new ResolveDeliveryLocationSellingPriceQuery(
        new PrismaDeliveryLocationSellingPriceQueryService()
      )
    );
    commonRepository = new PrismaCommonSellingPriceRepository();
    customerRepo = new PrismaCustomerSellingPriceRepository();
    deliveryLocationRepo = new PrismaDeliveryLocationSellingPriceRepository();
    await cleanup();

    const customer = await new PrismaCustomerRepository().insert(
      Customer.create(
        new CompanyCode(TEST_CUSTOMER_CODE),
        new CompanyName("価格決定オーケストレーションテスト得意先")
      )
    );
    customerId = customer.id;

    const deliveryLocation = await new PrismaDeliveryLocationRepository().insert(
      DeliveryLocation.create(
        new CompanyCode(TEST_DELIVERY_LOCATION_CODE),
        new CompanyName("価格決定オーケストレーションテスト納品先"),
        customer.id
      )
    );
    deliveryLocationId = deliveryLocation.id;

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("価格決定オーケストレーションテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("得意先宛: 得意先別の上書きがあれば共通より優先して採用する", async () => {
    const common = CommonSellingPrice.create(productId);
    common.addPeriod(period("2025-07-01", null), price(1000));
    await commonRepository.insert(common);

    const customerPrice = CustomerSellingPrice.create(customerId, productId);
    customerPrice.addPeriod(period("2025-07-01", null), price(800));
    await customerRepo.insert(customerPrice);

    const resolved = await query.execute({
      addressee: "CUSTOMER",
      customerId: customerId.value,
      productId: productId.value,
      estimateDate: new Date("2025-08-15T00:00:00+09:00"),
    });

    expect(resolved.equals(price(800))).toBe(true);
  });

  it("得意先宛: 得意先別が無ければ共通へフォールバックする", async () => {
    const common = CommonSellingPrice.create(productId);
    common.addPeriod(period("2025-07-01", null), price(1000));
    await commonRepository.insert(common);

    const resolved = await query.execute({
      addressee: "CUSTOMER",
      customerId: customerId.value,
      productId: productId.value,
      estimateDate: new Date("2025-08-15T00:00:00+09:00"),
    });

    expect(resolved.equals(price(1000))).toBe(true);
  });

  it("納品先宛: 納品先別の上書きへルーティングして採用する", async () => {
    const common = CommonSellingPrice.create(productId);
    common.addPeriod(period("2025-07-01", null), price(1000));
    await commonRepository.insert(common);

    const deliveryLocationPrice = DeliveryLocationSellingPrice.create(
      deliveryLocationId,
      productId
    );
    deliveryLocationPrice.addPeriod(period("2025-07-01", null), price(700));
    await deliveryLocationRepo.insert(deliveryLocationPrice);

    const resolved = await query.execute({
      addressee: "DELIVERY_LOCATION",
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      estimateDate: new Date("2025-08-15T00:00:00+09:00"),
    });

    expect(resolved.equals(price(700))).toBe(true);
  });

  it("全層に有効な単価が無ければ解決不能として BusinessRuleViolationError を貫通させる", async () => {
    await expect(
      query.execute({
        addressee: "CUSTOMER",
        customerId: customerId.value,
        productId: productId.value,
        estimateDate: new Date("2025-08-15T00:00:00+09:00"),
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("JST境界: UTC 15:00 の見積年月日は JST 翌日として暦日変換され、その日始まりの期間に解決する", async () => {
    // 2026-06-25 始まりの期間。UTC 2026-06-24T15:00:00Z = JST 2026-06-25 00:00 が初日に当たる。
    const common = CommonSellingPrice.create(productId);
    common.addPeriod(period("2026-06-25", null), price(1234));
    await commonRepository.insert(common);

    const resolved = await query.execute({
      addressee: "CUSTOMER",
      customerId: customerId.value,
      productId: productId.value,
      estimateDate: new Date("2026-06-24T15:00:00Z"),
    });

    expect(resolved.equals(price(1234))).toBe(true);
  });
});
