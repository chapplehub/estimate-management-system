import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { CommonSellingPrice, CustomerSellingPrice } from "@subdomains/pricing/domain/entities";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaCommonSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository";
import { PrismaCustomerSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCustomerSellingPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaCustomerSellingPriceQueryService } from "../PrismaCustomerSellingPriceQueryService";

// 実データ・他テストと衝突しない予約コード（CUSPQ7x = customer-selling-price QueryService 結合テスト）。
const TEST_PRODUCT_CODE = "CUSPQ70";
const OTHER_PRODUCT_CODE = "CUSPQ71";
const TEST_CUSTOMER_CODE = "CUSPQ72";
const OTHER_CUSTOMER_CODE = "CUSPQ73";

const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

async function cleanup(): Promise<void> {
  // products / customers を消すと FK onDelete: Cascade で customer/common_selling_prices と期間行も消える。
  await prisma.product.deleteMany({
    where: { code: { in: [TEST_PRODUCT_CODE, OTHER_PRODUCT_CODE] } },
  });
  await prisma.customer.deleteMany({
    where: { code: { in: [TEST_CUSTOMER_CODE, OTHER_CUSTOMER_CODE] } },
  });
}

describe("PrismaCustomerSellingPriceQueryService", () => {
  let queryService: PrismaCustomerSellingPriceQueryService;
  let repository: PrismaCustomerSellingPriceRepository;
  let customerId: CustomerId;
  let otherCustomerId: CustomerId;
  let productId: ProductId;
  let otherProductId: ProductId;

  beforeEach(async () => {
    queryService = new PrismaCustomerSellingPriceQueryService();
    repository = new PrismaCustomerSellingPriceRepository();
    await cleanup();

    // 得意先別販売単価は得意先 × 商品を親に持つ（FK 制約）。キー隔離検証用に別得意先・別商品も用意する。
    const customerRepository = new PrismaCustomerRepository();
    const customer = await customerRepository.insert(
      Customer.create(
        new CompanyCode(TEST_CUSTOMER_CODE),
        new CompanyName("得意先別単価QSテスト得意先")
      )
    );
    customerId = customer.id;
    const otherCustomer = await customerRepository.insert(
      Customer.create(
        new CompanyCode(OTHER_CUSTOMER_CODE),
        new CompanyName("得意先別単価QS別得意先")
      )
    );
    otherCustomerId = otherCustomer.id;

    const productRepository = new PrismaProductRepository();
    const product = await productRepository.insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("得意先別販売単価QSテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
    const otherProduct = await productRepository.insert(
      Product.create(
        new ProductCode(OTHER_PRODUCT_CODE),
        new ProductName("得意先別販売単価QS別商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    otherProductId = otherProduct.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("区間内の暦日で有効な得意先別単価を引く", async () => {
    const aggregate = CustomerSellingPrice.create(customerId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await queryService.resolve({
      customerId: customerId.value,
      productId: productId.value,
      date: "2025-08-15",
    });

    expect(result?.sellingPrice).toBe("1000.00");
  });

  it("同じ商品でも別の得意先では引かない（得意先キーの隔離）", async () => {
    const aggregate = CustomerSellingPrice.create(customerId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await queryService.resolve({
      customerId: otherCustomerId.value,
      productId: productId.value,
      date: "2025-08-15",
    });

    expect(result).toBeNull();
  });

  it("同じ得意先でも別の商品では引かない（商品キーの隔離）", async () => {
    const aggregate = CustomerSellingPrice.create(customerId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await queryService.resolve({
      customerId: customerId.value,
      productId: otherProductId.value,
      date: "2025-08-15",
    });

    expect(result).toBeNull();
  });

  it("同じ商品に共通販売単価があっても得意先別としては引かない（層の隔離）", async () => {
    // 共通販売単価だけを登録し、得意先別は1件も登録しない。
    // 得意先別 QueryService は customer_selling_price_periods のみを見るため null になる。
    const common = CommonSellingPrice.create(productId);
    common.addPeriod(period("2025-07-01", "2025-10-01"), price(1000), "2025-07-01");
    await new PrismaCommonSellingPriceRepository().insert(common);

    const result = await queryService.resolve({
      customerId: customerId.value,
      productId: productId.value,
      date: "2025-08-15",
    });

    expect(result).toBeNull();
  });

  it("どの適用期間にも覆われない暦日では null を返す", async () => {
    const aggregate = CustomerSellingPrice.create(customerId, productId);
    aggregate.addPeriod(period("2025-07-01", "2025-10-01"), price(1000));
    await repository.insert(aggregate);

    const result = await queryService.resolve({
      customerId: customerId.value,
      productId: productId.value,
      date: "2025-06-30",
    });

    expect(result).toBeNull();
  });
});
