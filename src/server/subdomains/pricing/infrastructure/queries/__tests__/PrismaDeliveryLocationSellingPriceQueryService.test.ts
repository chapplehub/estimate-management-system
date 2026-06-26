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
import {
  CommonSellingPrice,
  DeliveryLocationSellingPrice,
} from "@subdomains/pricing/domain/entities";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaCommonSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository";
import { PrismaDeliveryLocationSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaDeliveryLocationSellingPriceQueryService } from "../PrismaDeliveryLocationSellingPriceQueryService";

// 実データ・他テストと衝突しない予約コード（DLSPQ7x = delivery-location-selling-price QueryService 結合テスト）。
const TEST_PRODUCT_CODE = "DLSPQ70";
const OTHER_PRODUCT_CODE = "DLSPQ71";
const TEST_DELIVERY_LOCATION_CODE = "DLSPQ72";
const OTHER_DELIVERY_LOCATION_CODE = "DLSPQ73";
const PARENT_CUSTOMER_CODE = "DLSPQ74";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  // products を消すと FK onDelete: Cascade で delivery_location/common_selling_prices と期間行も消える。
  await prisma.product.deleteMany({
    where: { code: { in: [TEST_PRODUCT_CODE, OTHER_PRODUCT_CODE] } },
  });
  // delivery_locations を消すと同様に集約も消える。親得意先は最後に消す（FK 順序）。
  await prisma.deliveryLocation.deleteMany({
    where: { code: { in: [TEST_DELIVERY_LOCATION_CODE, OTHER_DELIVERY_LOCATION_CODE] } },
  });
  await prisma.customer.deleteMany({ where: { code: PARENT_CUSTOMER_CODE } });
}

describe("PrismaDeliveryLocationSellingPriceQueryService", () => {
  let queryService: PrismaDeliveryLocationSellingPriceQueryService;
  let repository: PrismaDeliveryLocationSellingPriceRepository;
  let deliveryLocationId: DeliveryLocationId;
  let otherDeliveryLocationId: DeliveryLocationId;
  let productId: ProductId;
  let otherProductId: ProductId;

  beforeEach(async () => {
    queryService = new PrismaDeliveryLocationSellingPriceQueryService();
    repository = new PrismaDeliveryLocationSellingPriceRepository();
    await cleanup();

    // 納品先別販売単価は納品先 × 商品を親に持つ（FK 制約）。納品先はさらに得意先を親に持つ。
    // キー隔離検証用に別納品先・別商品も用意する（別納品先は同じ親得意先でよい）。
    const customerRepository = new PrismaCustomerRepository();
    const customer = await customerRepository.insert(
      Customer.create(
        new CompanyCode(PARENT_CUSTOMER_CODE),
        new CompanyName("納品先別単価QS親得意先")
      )
    );

    const deliveryLocationRepository = new PrismaDeliveryLocationRepository();
    const deliveryLocation = await deliveryLocationRepository.insert(
      DeliveryLocation.create(
        new CompanyCode(TEST_DELIVERY_LOCATION_CODE),
        new CompanyName("納品先別単価QSテスト納品先"),
        customer.id
      )
    );
    deliveryLocationId = deliveryLocation.id;
    const otherDeliveryLocation = await deliveryLocationRepository.insert(
      DeliveryLocation.create(
        new CompanyCode(OTHER_DELIVERY_LOCATION_CODE),
        new CompanyName("納品先別単価QS別納品先"),
        customer.id
      )
    );
    otherDeliveryLocationId = otherDeliveryLocation.id;

    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("納品先別販売単価QSテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
    const otherProduct = await productRepository.insert(
      Product.create(
        new ProductCode(OTHER_PRODUCT_CODE),
        new ProductName("納品先別販売単価QS別商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    otherProductId = otherProduct.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("区間内の暦日で有効な納品先別単価を引く", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await queryService.resolve({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      date: "2025-08-15",
    });

    expect(result?.sellingPrice).toBe("1000.00");
  });

  it("同じ商品でも別の納品先では引かない（納品先キーの隔離）", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await queryService.resolve({
      deliveryLocationId: otherDeliveryLocationId.value,
      productId: productId.value,
      date: "2025-08-15",
    });

    expect(result).toBeNull();
  });

  it("同じ納品先でも別の商品では引かない（商品キーの隔離）", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await queryService.resolve({
      deliveryLocationId: deliveryLocationId.value,
      productId: otherProductId.value,
      date: "2025-08-15",
    });

    expect(result).toBeNull();
  });

  it("同じ商品に共通販売単価があっても納品先別としては引かない（層の隔離）", async () => {
    // 共通販売単価だけを登録し、納品先別は1件も登録しない。
    // 納品先別 QueryService は delivery_location_selling_price_periods のみを見るため null になる。
    const common = CommonSellingPrice.create(productId);
    common.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await new PrismaCommonSellingPriceRepository().insert(common);

    const result = await queryService.resolve({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      date: "2025-08-15",
    });

    expect(result).toBeNull();
  });

  it("どの適用期間にも覆われない暦日では null を返す", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(deliveryLocationId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await queryService.resolve({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      date: "2025-06-30",
    });

    expect(result).toBeNull();
  });
});
