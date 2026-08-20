import prisma from "@server/prisma";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { PrismaDeliveryLocationRepository } from "@subdomains/delivery-location/infrastructure/prisma/PrismaDeliveryLocationRepository";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaDeliveryLocationSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaDeliveryLocationSellingPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RegisterDeliveryLocationSellingPricePeriodCommand } from "../RegisterDeliveryLocationSellingPricePeriodCommand";

const TEST_PRODUCT_CODE = "DLSPCMD10";
const TEST_DELIVERY_LOCATION_CODE = "DLSPCMD11";
const PARENT_CUSTOMER_CODE = "DLSPCMD12";
const TEST_SET_PRODUCT_CODE = "DLSPCMD13";
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({
    where: { code: { in: [TEST_PRODUCT_CODE, TEST_SET_PRODUCT_CODE] } },
  });
  await prisma.deliveryLocation.deleteMany({ where: { code: TEST_DELIVERY_LOCATION_CODE } });
  await prisma.customer.deleteMany({ where: { code: PARENT_CUSTOMER_CODE } });
}

describe("RegisterDeliveryLocationSellingPricePeriodCommand", () => {
  let command: RegisterDeliveryLocationSellingPricePeriodCommand;
  let repository: PrismaDeliveryLocationSellingPriceRepository;
  let deliveryLocationId: DeliveryLocationId;
  let productId: ProductId;
  let setProductId: ProductId;

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaDeliveryLocationSellingPriceRepository();
    command = new RegisterDeliveryLocationSellingPricePeriodCommand(
      repository,
      new PrismaProductQueryService()
    );

    // 納品先別販売単価は納品先 × 商品を親に持つ（FK 制約）。納品先はさらに得意先を親に持つ。
    const customer = await new PrismaCustomerRepository().insert(
      Customer.create(
        new CompanyCode(PARENT_CUSTOMER_CODE),
        new CompanyName("登録コマンドテスト親得意先")
      )
    );

    const deliveryLocation = await new PrismaDeliveryLocationRepository().insert(
      DeliveryLocation.create(
        new CompanyCode(TEST_DELIVERY_LOCATION_CODE),
        new CompanyName("登録コマンドテスト納品先"),
        customer.id
      )
    );
    deliveryLocationId = deliveryLocation.id;

    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName(`登録コマンドテスト商品${TEST_PRODUCT_CODE}`),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;

    const setProduct = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_SET_PRODUCT_CODE),
        new ProductName(`登録コマンドテストセット商品${TEST_SET_PRODUCT_CODE}`),
        ProductCategory.SET,
        ProductUnit.UNIT
      )
    );
    setProductId = setProduct.id;
  });

  afterEach(cleanup);

  it("未設定の納品先×商品に最初の期間を登録できる（新規 insert）", async () => {
    const result = await command.execute({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      start: "2030-01-01",
      end: null,
      price: "1000",
      referenceDate: "2025-06-01",
    });

    expect(result.periods).toHaveLength(1);
    const found = await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    );
    expect(found!.periods).toHaveLength(1);
    expect(found!.periods[0].price.equals(price(1000))).toBe(true);
  });

  it("既存集約へ2本目の期間を追加できる（expectedVersion での update）", async () => {
    await command.execute({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      start: "2030-01-01",
      end: "2030-06-01",
      price: "1000",
      referenceDate: "2025-06-01",
    });

    await command.execute({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      start: "2030-06-01",
      end: null,
      price: "1200",
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    );
    expect(found!.periods).toHaveLength(2);
  });

  it("開始日が今日より前なら BusinessRuleViolationError（参照日が domain まで素通しされる）", async () => {
    await expect(
      command.execute({
        deliveryLocationId: deliveryLocationId.value,
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
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      start: "2030-01-01",
      end: "2030-06-01",
      price: "1000",
      referenceDate: "2025-06-01",
    });

    await expect(
      command.execute({
        deliveryLocationId: deliveryLocationId.value,
        productId: productId.value,
        start: "2030-06-01",
        end: null,
        price: "1200",
        referenceDate: "2025-06-01",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("セット商品には販売単価を登録できない（ValidationError・ファクトリガード / #531）", async () => {
    // セット商品は自前の売単価を持たず構成商品から導出されるため、生成入口で拒否する。
    await expect(
      command.execute({
        deliveryLocationId: deliveryLocationId.value,
        productId: setProductId.value,
        start: "2030-01-01",
        end: null,
        price: "1000",
        referenceDate: "2025-06-01",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("存在しない商品IDでは登録できない（ValidationError・入力契約違反 / #531）", async () => {
    await expect(
      command.execute({
        deliveryLocationId: deliveryLocationId.value,
        productId: ProductId.generate().value,
        start: "2030-01-01",
        end: null,
        price: "1000",
        referenceDate: "2025-06-01",
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("既存集約への追加で expectedVersion が古いと ConflictError（expectedVersion が repo まで素通しされる）", async () => {
    await command.execute({
      deliveryLocationId: deliveryLocationId.value,
      productId: productId.value,
      start: "2030-01-01",
      end: "2030-06-01",
      price: "1000",
      referenceDate: "2025-06-01",
    });

    await expect(
      command.execute({
        deliveryLocationId: deliveryLocationId.value,
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
