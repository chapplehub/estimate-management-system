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
import { DeliveryLocationSellingPrice } from "@subdomains/pricing/domain/entities";
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
import { PrismaDeliveryLocationSellingPriceEditQueryService } from "../PrismaDeliveryLocationSellingPriceEditQueryService";

// DLSPE{...} = delivery-location-selling-price 編集読みモデルのテスト用予約コード（他ファイルとの並列衝突回避）。
const CUSTOMER_CODE = "DLSPE01C";
const CUSTOMER_NAME = "納品先別編集読みモデルテスト親得意先";
const DL_CODE = "DLSPE01D";
const DL_NAME = "納品先別編集読みモデルテスト納品先";
const PRODUCT_CODE = "DLSPE01P";
const PRODUCT_NAME = `納品先別編集読みモデルテスト商品${PRODUCT_CODE}`;

const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  // products を消すと FK Cascade で単価・期間行も消える。
  await prisma.product.deleteMany({ where: { code: PRODUCT_CODE } });
  // delivery_locations を消すと集約も消える。親得意先は最後（FK 順序）。
  await prisma.deliveryLocation.deleteMany({ where: { code: DL_CODE } });
  await prisma.customer.deleteMany({ where: { code: CUSTOMER_CODE } });
}

describe("PrismaDeliveryLocationSellingPriceEditQueryService", () => {
  let queryService: PrismaDeliveryLocationSellingPriceEditQueryService;
  let repository: PrismaDeliveryLocationSellingPriceRepository;
  let customerId: CustomerId;
  let deliveryLocationId: DeliveryLocationId;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    queryService = new PrismaDeliveryLocationSellingPriceEditQueryService();
    repository = new PrismaDeliveryLocationSellingPriceRepository();

    const customer = await new PrismaCustomerRepository().insert(
      Customer.create(new CompanyCode(CUSTOMER_CODE), new CompanyName(CUSTOMER_NAME))
    );
    customerId = customer.id;

    const deliveryLocation = await new PrismaDeliveryLocationRepository().insert(
      DeliveryLocation.create(new CompanyCode(DL_CODE), new CompanyName(DL_NAME), customerId)
    );
    deliveryLocationId = deliveryLocation.id;

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(PRODUCT_CODE),
        new ProductName(PRODUCT_NAME),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(cleanup);

  it("identity（親得意先含む）・version・期間行配列を返し、各行に時点状態（将来/現在有効/失効）を算出する", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(
      deliveryLocationId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    aggregate.addPeriod(period("2025-01-01", "2025-03-01"), price(800), "2025-01-01"); // 失効
    aggregate.addPeriod(period("2025-03-01", "2025-09-01"), price(1000), "2025-03-01"); // 現在有効
    aggregate.addPeriod(period("2030-01-01", null), price(1200), "2025-01-01"); // 将来
    await repository.insert(aggregate);

    const dto = await queryService.find({
      deliveryLocationCode: DL_CODE,
      productCode: PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });

    expect(dto).not.toBeNull();
    expect(dto!.deliveryLocationId).toBe(deliveryLocationId.value);
    expect(dto!.deliveryLocationCode).toBe(DL_CODE);
    expect(dto!.deliveryLocationName).toBe(DL_NAME);
    expect(dto!.deliveryLocationIsActive).toBe(true);
    expect(dto!.productId).toBe(productId.value);
    expect(dto!.productCode).toBe(PRODUCT_CODE);
    expect(dto!.productName).toBe(PRODUCT_NAME);
    expect(dto!.productIsActive).toBe(true);
    // 親得意先 identity（得意先別 #506 からの形状差）
    expect(dto!.customerId).toBe(customerId.value);
    expect(dto!.customerCode).toBe(CUSTOMER_CODE);
    expect(dto!.customerName).toBe(CUSTOMER_NAME);
    expect(dto!.version).toBe(1);

    // lower(applicable_period) 昇順
    expect(dto!.periods).toHaveLength(3);
    expect(dto!.periods.map((p) => p.status)).toEqual(["expired", "active", "future"]);

    const [expired, active, future] = dto!.periods;
    expect(expired.start).toBe("2025-01-01");
    expect(expired.end).toBe("2025-03-01");
    expect(expired.sellingPrice).toBe("800.00");
    expect(active.sellingPrice).toBe("1000.00");
    expect(future.end).toBeNull();
    expect(future.sellingPrice).toBe("1200.00");
  });

  it("納品先・商品は在るが集約が無い場合は identity＋version=null＋空 periods（新規登録モード）", async () => {
    const dto = await queryService.find({
      deliveryLocationCode: DL_CODE,
      productCode: PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });

    expect(dto).not.toBeNull();
    expect(dto!.deliveryLocationId).toBe(deliveryLocationId.value);
    expect(dto!.productId).toBe(productId.value);
    expect(dto!.customerId).toBe(customerId.value);
    expect(dto!.version).toBeNull();
    expect(dto!.periods).toEqual([]);
  });

  it("納品先が存在しない場合は null（FE は notFound）", async () => {
    const dto = await queryService.find({
      deliveryLocationCode: "DLSPE99D",
      productCode: PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });
    expect(dto).toBeNull();
  });

  it("商品が存在しない場合は null（FE は notFound）", async () => {
    const dto = await queryService.find({
      deliveryLocationCode: DL_CODE,
      productCode: "DLSPE99P",
      referenceDate: "2025-06-15",
    });
    expect(dto).toBeNull();
  });

  it("無効な納品先・無効な商品でも identity を返し、有効フラグに反映する", async () => {
    const dlRepo = new PrismaDeliveryLocationRepository();
    const deactivatedDl = (await dlRepo.findById(deliveryLocationId))!;
    deactivatedDl.deactivate();
    await dlRepo.update(deactivatedDl, 1);

    const productRepo = new PrismaProductRepository();
    const reloadedProduct = (await productRepo.findById(productId))!;
    reloadedProduct.deactivate();
    await productRepo.update(reloadedProduct, 1);

    const dto = await queryService.find({
      deliveryLocationCode: DL_CODE,
      productCode: PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });

    expect(dto).not.toBeNull();
    expect(dto!.deliveryLocationIsActive).toBe(false);
    expect(dto!.productIsActive).toBe(false);
  });

  it("update 後の version を反映する（楽観ロックトークン）", async () => {
    const aggregate = DeliveryLocationSellingPrice.create(
      deliveryLocationId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    aggregate.addPeriod(period("2030-01-01", "2030-06-01"), price(1000), "2025-06-01");
    await repository.insert(aggregate);

    const reloaded = (await repository.findByDeliveryLocationIdAndProductId(
      deliveryLocationId,
      productId
    ))!;
    reloaded.addPeriod(period("2030-06-01", null), price(1200), "2025-06-01");
    await repository.update(reloaded, 1);

    const dto = await queryService.find({
      deliveryLocationCode: DL_CODE,
      productCode: PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });
    expect(dto!.version).toBe(2);
  });
});
