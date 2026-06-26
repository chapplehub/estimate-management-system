import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { CustomerSellingPrice } from "@subdomains/pricing/domain/entities";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaCustomerSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCustomerSellingPriceRepository";
import { PrismaCustomerSellingPriceQueryService } from "@subdomains/pricing/infrastructure/queries/PrismaCustomerSellingPriceQueryService";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResolveCustomerSellingPriceQuery } from "../ResolveCustomerSellingPriceQuery";

// 実データ・他テストと衝突しない予約コード（CUSPQ8x = customer-selling-price QueryService ラッパ結合テスト）。
const TEST_PRODUCT_CODE = "CUSPQ80";
const TEST_CUSTOMER_CODE = "CUSPQ81";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
  await prisma.customer.deleteMany({ where: { code: TEST_CUSTOMER_CODE } });
}

describe("ResolveCustomerSellingPriceQuery", () => {
  let query: ResolveCustomerSellingPriceQuery;
  let repository: PrismaCustomerSellingPriceRepository;
  let customerId: CustomerId;
  let productId: ProductId;

  beforeEach(async () => {
    query = new ResolveCustomerSellingPriceQuery(new PrismaCustomerSellingPriceQueryService());
    repository = new PrismaCustomerSellingPriceRepository();
    await cleanup();

    const customerRepository = new PrismaCustomerRepository();
    const customer = await customerRepository.insert(
      Customer.create(
        new CompanyCode(TEST_CUSTOMER_CODE),
        new CompanyName("得意先別単価ラッパテスト得意先")
      )
    );
    customerId = customer.id;

    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("得意先別販売単価ラッパテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("基準暦日に有効な得意先別販売単価を解決する", async () => {
    const aggregate = CustomerSellingPrice.create(customerId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await query.execute({
      customerId: customerId.value,
      productId: productId.value,
      date: "2025-08-15",
    });

    expect(result?.sellingPrice).toBe("1000.00");
  });

  it("有効な単価が無ければ null を返す", async () => {
    const result = await query.execute({
      customerId: customerId.value,
      productId: productId.value,
      date: "2025-08-15",
    });

    expect(result).toBeNull();
  });
});
