import prisma from "@server/prisma";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { CustomerSellingPrice } from "@subdomains/pricing/domain/entities";
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
import { PrismaCustomerSellingPriceEditQueryService } from "../PrismaCustomerSellingPriceEditQueryService";

// CSPED{...} = customer-selling-price 編集読みモデルのテスト用予約コード（他ファイルとの並列衝突回避）。
const CUSTOMER_CODE = "CSPED01C";
const CUSTOMER_NAME = "編集読みモデルテスト得意先";
const PRODUCT_CODE = "CSPED01P";
const PRODUCT_NAME = `編集読みモデルテスト商品${PRODUCT_CODE}`;

const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.customer.deleteMany({ where: { code: CUSTOMER_CODE } });
  await prisma.product.deleteMany({ where: { code: PRODUCT_CODE } });
}

describe("PrismaCustomerSellingPriceEditQueryService", () => {
  let queryService: PrismaCustomerSellingPriceEditQueryService;
  let repository: PrismaCustomerSellingPriceRepository;
  let customerId: CustomerId;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    queryService = new PrismaCustomerSellingPriceEditQueryService();
    repository = new PrismaCustomerSellingPriceRepository();

    const customer = await new PrismaCustomerRepository().insert(
      Customer.create(new CompanyCode(CUSTOMER_CODE), new CompanyName(CUSTOMER_NAME))
    );
    customerId = customer.id;

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

  it("identity・version・期間行配列を返し、各行に時点状態（将来/現在有効/失効）を算出する", async () => {
    const aggregate = CustomerSellingPrice.create(
      customerId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    aggregate.addPeriod(period("2025-01-01", "2025-03-01"), price(800), "2025-01-01"); // 失効
    aggregate.addPeriod(period("2025-03-01", "2025-09-01"), price(1000), "2025-03-01"); // 現在有効
    aggregate.addPeriod(period("2030-01-01", null), price(1200), "2025-01-01"); // 将来
    await repository.insert(aggregate);

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      productCode: PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });

    expect(dto).not.toBeNull();
    expect(dto!.customerId).toBe(customerId.value);
    expect(dto!.customerCode).toBe(CUSTOMER_CODE);
    expect(dto!.customerName).toBe(CUSTOMER_NAME);
    expect(dto!.customerIsActive).toBe(true);
    expect(dto!.productId).toBe(productId.value);
    expect(dto!.productCode).toBe(PRODUCT_CODE);
    expect(dto!.productName).toBe(PRODUCT_NAME);
    expect(dto!.productIsActive).toBe(true);
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

  it("得意先・商品は在るが集約が無い場合は identity＋version=null＋空 periods（新規登録モード）", async () => {
    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      productCode: PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });

    expect(dto).not.toBeNull();
    expect(dto!.customerId).toBe(customerId.value);
    expect(dto!.productId).toBe(productId.value);
    expect(dto!.version).toBeNull();
    expect(dto!.periods).toEqual([]);
  });

  it("得意先が存在しない場合は null（FE は notFound）", async () => {
    const dto = await queryService.find({
      customerCode: "CSPED99C",
      productCode: PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });
    expect(dto).toBeNull();
  });

  it("商品が存在しない場合は null（FE は notFound）", async () => {
    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      productCode: "CSPED99P",
      referenceDate: "2025-06-15",
    });
    expect(dto).toBeNull();
  });

  it("無効な得意先・無効な商品でも identity を返し、有効フラグに反映する", async () => {
    const customerRepo = new PrismaCustomerRepository();
    const deactivatedCustomer = (await customerRepo.findById(customerId))!;
    deactivatedCustomer.deactivate();
    await customerRepo.update(deactivatedCustomer, 1);

    const productRepo = new PrismaProductRepository();
    const reloadedProduct = (await productRepo.findById(productId))!;
    reloadedProduct.deactivate();
    await productRepo.update(reloadedProduct, 1);

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      productCode: PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });

    expect(dto).not.toBeNull();
    expect(dto!.customerIsActive).toBe(false);
    expect(dto!.productIsActive).toBe(false);
  });

  it("update 後の version を反映する（楽観ロックトークン）", async () => {
    const aggregate = CustomerSellingPrice.create(
      customerId,
      productId,
      ProductCategory.INDIVIDUAL
    );
    aggregate.addPeriod(period("2030-01-01", "2030-06-01"), price(1000), "2025-06-01");
    await repository.insert(aggregate);

    const reloaded = (await repository.findByCustomerIdAndProductId(customerId, productId))!;
    reloaded.addPeriod(period("2030-06-01", null), price(1200), "2025-06-01");
    await repository.update(reloaded, 1);

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      productCode: PRODUCT_CODE,
      referenceDate: "2025-06-15",
    });
    expect(dto!.version).toBe(2);
  });
});
