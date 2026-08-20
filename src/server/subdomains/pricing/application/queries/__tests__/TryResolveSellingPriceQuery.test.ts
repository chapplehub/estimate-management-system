import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
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
import { TryResolveSellingPriceQuery } from "../TryResolveSellingPriceQuery";

// 実データ・他テストと衝突しない予約コード（TRSP = try-resolve-selling-price 非throw解決結合テスト）。
const TEST_PRODUCT_CODE = "TRSP80";
const TEST_CUSTOMER_CODE = "TRSP81";
const TEST_DELIVERY_LOCATION_CODE = "TRSP82";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
  await prisma.deliveryLocation.deleteMany({ where: { code: TEST_DELIVERY_LOCATION_CODE } });
  await prisma.customer.deleteMany({ where: { code: TEST_CUSTOMER_CODE } });
}

describe("TryResolveSellingPriceQuery", () => {
  let query: TryResolveSellingPriceQuery;
  let commonRepository: PrismaCommonSellingPriceRepository;
  let customerRepo: PrismaCustomerSellingPriceRepository;
  let deliveryLocationRepo: PrismaDeliveryLocationSellingPriceRepository;
  let customerId: CustomerId;
  let deliveryLocationId: DeliveryLocationId;
  let productId: ProductId;

  beforeEach(async () => {
    query = new TryResolveSellingPriceQuery(
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
        new CompanyName("非throw解決テスト得意先")
      )
    );
    customerId = customer.id;

    const deliveryLocation = await new PrismaDeliveryLocationRepository().insert(
      DeliveryLocation.create(
        new CompanyCode(TEST_DELIVERY_LOCATION_CODE),
        new CompanyName("非throw解決テスト納品先"),
        customer.id
      )
    );
    deliveryLocationId = deliveryLocation.id;

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("非throw解決テスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("得意先宛: 得意先別の上書きを RESOLVED として採用する（共通より優先）", async () => {
    const common = CommonSellingPrice.create(productId, ProductCategory.INDIVIDUAL);
    common.addPeriod(period("2025-07-01", null), price(1000), "2025-07-01");
    await commonRepository.insert(common);

    const customerPrice = CustomerSellingPrice.create(
      customerId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    customerPrice.addPeriod(period("2025-07-01", null), price(800), "2025-07-01");
    await customerRepo.insert(customerPrice);

    const outcome = await query.execute({
      addressee: "CUSTOMER",
      customerId: customerId.value,
      productId: productId.value,
      estimateDate: new Date("2025-08-15T00:00:00+09:00"),
    });

    expect(outcome.kind).toBe("RESOLVED");
    if (outcome.kind === "RESOLVED") {
      expect(outcome.unitPrice.equals(price(800))).toBe(true);
    }
  });

  it("得意先宛: 得意先別が無ければ共通を RESOLVED として返す", async () => {
    const common = CommonSellingPrice.create(productId, ProductCategory.INDIVIDUAL);
    common.addPeriod(period("2025-07-01", null), price(1000), "2025-07-01");
    await commonRepository.insert(common);

    const outcome = await query.execute({
      addressee: "CUSTOMER",
      customerId: customerId.value,
      productId: productId.value,
      estimateDate: new Date("2025-08-15T00:00:00+09:00"),
    });

    expect(outcome.kind).toBe("RESOLVED");
    if (outcome.kind === "RESOLVED") {
      expect(outcome.unitPrice.equals(price(1000))).toBe(true);
    }
  });

  it("納品先宛: 納品先別の上書きを RESOLVED として採用する", async () => {
    const deliveryLocationPrice = DeliveryLocationSellingPrice.create(
      deliveryLocationId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    deliveryLocationPrice.addPeriod(period("2025-07-01", null), price(700), "2025-07-01");
    await deliveryLocationRepo.insert(deliveryLocationPrice);

    const outcome = await query.execute({
      addressee: "DELIVERY_LOCATION",
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      estimateDate: new Date("2025-08-15T00:00:00+09:00"),
    });

    expect(outcome.kind).toBe("RESOLVED");
    if (outcome.kind === "RESOLVED") {
      expect(outcome.unitPrice.equals(price(700))).toBe(true);
    }
  });

  it("全層に有効な単価が無ければ throw せず UNRESOLVABLE を返す", async () => {
    const outcome = await query.execute({
      addressee: "CUSTOMER",
      customerId: customerId.value,
      productId: productId.value,
      estimateDate: new Date("2025-08-15T00:00:00+09:00"),
    });

    expect(outcome.kind).toBe("UNRESOLVABLE");
  });

  it("見積年月日が全期間より前なら（適用開始前）解決不能として UNRESOLVABLE を返す", async () => {
    const common = CommonSellingPrice.create(productId, ProductCategory.INDIVIDUAL);
    common.addPeriod(period("2025-07-01", null), price(1000), "2025-07-01");
    await commonRepository.insert(common);

    const outcome = await query.execute({
      addressee: "CUSTOMER",
      customerId: customerId.value,
      productId: productId.value,
      estimateDate: new Date("2025-06-15T00:00:00+09:00"),
    });

    expect(outcome.kind).toBe("UNRESOLVABLE");
  });
});
