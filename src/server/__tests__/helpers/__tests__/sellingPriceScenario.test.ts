import prisma from "@server/prisma";
import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { ResolveCommonSellingPriceQuery } from "@subdomains/pricing/application/queries/ResolveCommonSellingPriceQuery";
import { ResolveCustomerSellingPriceQuery } from "@subdomains/pricing/application/queries/ResolveCustomerSellingPriceQuery";
import { ResolveDeliveryLocationSellingPriceQuery } from "@subdomains/pricing/application/queries/ResolveDeliveryLocationSellingPriceQuery";
import { ResolveSellingPriceQuery } from "@subdomains/pricing/application/queries/ResolveSellingPriceQuery";
import { PrismaCommonSellingPriceQueryService } from "@subdomains/pricing/infrastructure/queries/PrismaCommonSellingPriceQueryService";
import { PrismaCustomerSellingPriceQueryService } from "@subdomains/pricing/infrastructure/queries/PrismaCustomerSellingPriceQueryService";
import { PrismaDeliveryLocationSellingPriceQueryService } from "@subdomains/pricing/infrastructure/queries/PrismaDeliveryLocationSellingPriceQueryService";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  giveCommonSellingPrice,
  giveCustomerSellingPrice,
  giveDeliveryLocationSellingPrice,
} from "../sellingPriceScenario";

// 予約コード（SPSH = selling-price-scenario-helper）。他テストと衝突しないよう固有接頭辞で確保する。
const TEST_PRODUCT_CODE = "SPSH80";
const TEST_CUSTOMER_CODE = "SPSH81";
const TEST_DELIVERY_LOCATION_CODE = "SPSH82";

const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

// 今日以降の日付（addPeriod の過去不変制約を満たしつつ確実に解決する見積年月日）。
const RESOLVE_DATE = new Date();

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
  await prisma.deliveryLocation.deleteMany({ where: { code: TEST_DELIVERY_LOCATION_CODE } });
  await prisma.customer.deleteMany({ where: { code: TEST_CUSTOMER_CODE } });
}

describe("sellingPriceScenario ヘルパー", () => {
  let query: ResolveSellingPriceQuery;
  let customerId: string;
  let deliveryLocationId: string;
  let productId: string;

  beforeEach(async () => {
    query = new ResolveSellingPriceQuery(
      new ResolveCommonSellingPriceQuery(new PrismaCommonSellingPriceQueryService()),
      new ResolveCustomerSellingPriceQuery(new PrismaCustomerSellingPriceQueryService()),
      new ResolveDeliveryLocationSellingPriceQuery(
        new PrismaDeliveryLocationSellingPriceQueryService()
      )
    );
    await cleanup();

    const customer = await new PrismaCustomerRepository().insert(
      Customer.create(
        new CompanyCode(TEST_CUSTOMER_CODE),
        new CompanyName("シナリオヘルパーテスト得意先")
      )
    );
    customerId = customer.id.value;

    const deliveryLocation = await new PrismaDeliveryLocationRepository().insert(
      DeliveryLocation.create(
        new CompanyCode(TEST_DELIVERY_LOCATION_CODE),
        new CompanyName("シナリオヘルパーテスト納品先"),
        customer.id
      )
    );
    deliveryLocationId = deliveryLocation.id.value;

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("シナリオヘルパーテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id.value;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("共通販売単価を与えると、その単価で解決される（既定は今日始まり・無期限）", async () => {
    await giveCommonSellingPrice(productId, { yen: 1000 });

    const resolved = await query.execute({
      addressee: "CUSTOMER",
      customerId,
      productId,
      estimateDate: RESOLVE_DATE,
    });

    expect(resolved.equals(price(1000))).toBe(true);
  });

  it("得意先別販売単価は共通より優先して解決される", async () => {
    await giveCommonSellingPrice(productId, { yen: 1000 });
    await giveCustomerSellingPrice(customerId, productId, { yen: 800 });

    const resolved = await query.execute({
      addressee: "CUSTOMER",
      customerId,
      productId,
      estimateDate: RESOLVE_DATE,
    });

    expect(resolved.equals(price(800))).toBe(true);
  });

  it("納品先別販売単価は納品先宛の解決で採用される", async () => {
    await giveCommonSellingPrice(productId, { yen: 1000 });
    await giveDeliveryLocationSellingPrice(deliveryLocationId, productId, { yen: 700 });

    const resolved = await query.execute({
      addressee: "DELIVERY_LOCATION",
      deliveryLocationId,
      productId,
      estimateDate: RESOLVE_DATE,
    });

    expect(resolved.equals(price(700))).toBe(true);
  });

  it("販売単価を与えなければ解決不能として BusinessRuleViolationError になる", async () => {
    await expect(
      query.execute({
        addressee: "CUSTOMER",
        customerId,
        productId,
        estimateDate: RESOLVE_DATE,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("同じ商品に対して二度与えても、後の単価で置き換わる（冪等・並列実行に耐える）", async () => {
    await giveCommonSellingPrice(productId, { yen: 1000 });
    await giveCommonSellingPrice(productId, { yen: 1200 });

    const resolved = await query.execute({
      addressee: "CUSTOMER",
      customerId,
      productId,
      estimateDate: RESOLVE_DATE,
    });

    expect(resolved.equals(price(1200))).toBe(true);
  });
});
