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
import { PrismaCustomerSellingPriceListQueryService } from "../PrismaCustomerSellingPriceListQueryService";

// CSPLS{...} = customer-selling-price 一覧読みモデルのテスト用予約コード（他ファイルとの並列衝突回避）。
const CUSTOMER_CODE = "CSPLS01C";
const CUSTOMER_NAME = "一覧読みモデルテスト得意先";
const OTHER_CUSTOMER_CODE = "CSPLS02C"; // 他得意先（行が混入しないことの確認用）
const OTHER_CUSTOMER_NAME = "一覧読みモデルテスト他得意先";
const CODES = {
  active: "CSPLS01P",
  none: "CSPLS02P",
  futureOnly: "CSPLS03P",
  expiredOnly: "CSPLS04P",
  set: "CSPLS05P",
  common: "CSPLS06P",
} as const;

const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.customer.deleteMany({
    where: { code: { in: [CUSTOMER_CODE, OTHER_CUSTOMER_CODE] } },
  });
  await prisma.product.deleteMany({ where: { code: { in: Object.values(CODES) } } });
}

async function makeCustomer(code: string, name: string): Promise<CustomerId> {
  const customer = await new PrismaCustomerRepository().insert(
    Customer.create(new CompanyCode(code), new CompanyName(name))
  );
  return customer.id;
}

async function makeProduct(
  code: string,
  name: string,
  category: ProductCategory = ProductCategory.INDIVIDUAL
): Promise<ProductId> {
  const product = await new PrismaProductRepository().insert(
    Product.create(
      new ProductCode(code),
      // products.name は @unique。他テストファイルとの並列実行衝突を code 接尾で防ぐ（#517）
      new ProductName(`${name}${code}`),
      category,
      ProductUnit.UNIT
    )
  );
  return product.id;
}

async function addCustomerPrice(
  customerId: CustomerId,
  productId: ProductId,
  start: string,
  end: string | null,
  yen: number,
  referenceDate: string
): Promise<void> {
  const aggregate = CustomerSellingPrice.create(customerId, productId, ProductCategory.INDIVIDUAL);
  aggregate.addPeriod(period(start, end), price(yen), referenceDate);
  await new PrismaCustomerSellingPriceRepository().insert(aggregate);
}

async function addCommonPrice(
  productId: ProductId,
  start: string,
  end: string | null,
  yen: number,
  referenceDate: string
): Promise<void> {
  const aggregate = CommonSellingPrice.create(productId, ProductCategory.INDIVIDUAL);
  aggregate.addPeriod(period(start, end), price(yen), referenceDate);
  await new PrismaCommonSellingPriceRepository().insert(aggregate);
}

describe("PrismaCustomerSellingPriceListQueryService", () => {
  let queryService: PrismaCustomerSellingPriceListQueryService;
  let customerId: CustomerId;

  beforeEach(async () => {
    await cleanup();
    queryService = new PrismaCustomerSellingPriceListQueryService();
    customerId = await makeCustomer(CUSTOMER_CODE, CUSTOMER_NAME);
  });

  afterEach(cleanup);

  it("得意先が存在しなければ null（FE は notFound）", async () => {
    const dto = await queryService.find({
      customerCode: "CSPLS99C",
      referenceDate: "2025-06-15",
    });
    expect(dto).toBeNull();
  });

  it("封筒に得意先 identity を同梱して返す", async () => {
    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      referenceDate: "2025-06-15",
    });

    expect(dto).not.toBeNull();
    expect(dto!.customerId).toBe(customerId.value);
    expect(dto!.customerCode).toBe(CUSTOMER_CODE);
    expect(dto!.customerName).toBe(CUSTOMER_NAME);
    expect(dto!.customerIsActive).toBe(true);
  });

  it("現在有効な得意先別単価がある商品は currentSellingPrice を値で返し priceStatus=active", async () => {
    const productId = await makeProduct(CODES.active, "現在有効商品");
    await addCustomerPrice(customerId, productId, "2025-01-01", null, 900, "2025-01-01");

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      referenceDate: "2025-06-15",
    });
    const item = dto!.items.find((i) => i.productCode === CODES.active);

    expect(item).toBeDefined();
    expect(item!.currentSellingPrice).toBe("900.00");
    expect(item!.priceStatus).toBe("active");
    expect(item!.currentPeriodStart).toBe("2025-01-01");
    expect(item!.currentPeriodEnd).toBeNull();
  });

  it("得意先別期間行が無い商品は currentSellingPrice=null・priceStatus=none（上書きなし）", async () => {
    await makeProduct(CODES.none, "上書きなし商品");

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      referenceDate: "2025-06-15",
    });
    const item = dto!.items.find((i) => i.productCode === CODES.none);

    expect(item).toBeDefined();
    expect(item!.currentSellingPrice).toBeNull();
    expect(item!.priceStatus).toBe("none");
    expect(item!.currentPeriodStart).toBeNull();
    expect(item!.currentPeriodEnd).toBeNull();
  });

  it("将来行のみの商品は currentSellingPrice=null・priceStatus=lapsed（失効中）", async () => {
    const productId = await makeProduct(CODES.futureOnly, "将来のみ商品");
    await addCustomerPrice(customerId, productId, "2030-01-01", null, 900, "2025-01-01");

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      referenceDate: "2025-06-15",
    });
    const item = dto!.items.find((i) => i.productCode === CODES.futureOnly);

    expect(item!.currentSellingPrice).toBeNull();
    expect(item!.priceStatus).toBe("lapsed");
  });

  it("失効行のみの商品は currentSellingPrice=null・priceStatus=lapsed（失効中）", async () => {
    const productId = await makeProduct(CODES.expiredOnly, "失効のみ商品");
    await addCustomerPrice(customerId, productId, "2025-01-01", "2025-03-01", 900, "2025-01-01");

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      referenceDate: "2025-06-15",
    });
    const item = dto!.items.find((i) => i.productCode === CODES.expiredOnly);

    expect(item!.currentSellingPrice).toBeNull();
    expect(item!.priceStatus).toBe("lapsed");
  });

  it("共通単価を currentCommonSellingPrice に並記する（COALESCE しない）", async () => {
    // 得意先別あり・共通ありの商品: 両方が独立カラムに並ぶ
    const productId = await makeProduct(CODES.common, "得意先別と共通の両方がある商品");
    await addCustomerPrice(customerId, productId, "2025-01-01", null, 900, "2025-01-01");
    await addCommonPrice(productId, "2025-01-01", null, 1000, "2025-01-01");

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      referenceDate: "2025-06-15",
    });
    const item = dto!.items.find((i) => i.productCode === CODES.common);

    expect(item!.currentSellingPrice).toBe("900.00");
    expect(item!.currentCommonSellingPrice).toBe("1000.00");
  });

  it("共通単価が無ければ currentCommonSellingPrice=null（並記対象なし）", async () => {
    const productId = await makeProduct(CODES.active, "共通なし商品");
    await addCustomerPrice(customerId, productId, "2025-01-01", null, 900, "2025-01-01");

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      referenceDate: "2025-06-15",
    });
    const item = dto!.items.find((i) => i.productCode === CODES.active);

    expect(item!.currentSellingPrice).toBe("900.00");
    expect(item!.currentCommonSellingPrice).toBeNull();
  });

  it("セット商品は価格保守対象外なので一覧に現れない（#514）", async () => {
    await makeProduct(CODES.set, "セット商品", ProductCategory.SET);

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      referenceDate: "2025-06-15",
    });
    const codes = dto!.items.map((i) => i.productCode);

    expect(codes).not.toContain(CODES.set);
  });

  it("他得意先の得意先別行は混入しない（priceStatus は指定得意先の行のみで判定）", async () => {
    // 商品は共通の母集合。指定得意先には上書きなし、他得意先にだけ上書きがある。
    const productId = await makeProduct(CODES.none, "他得意先のみ上書き商品");
    const otherId = await makeCustomer(OTHER_CUSTOMER_CODE, OTHER_CUSTOMER_NAME);
    await addCustomerPrice(otherId, productId, "2025-01-01", null, 900, "2025-01-01");

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      referenceDate: "2025-06-15",
    });
    const item = dto!.items.find((i) => i.productCode === CODES.none);

    // 指定得意先から見れば上書きは無い＝none。他得意先の active 行に引きずられてはならない。
    expect(item!.currentSellingPrice).toBeNull();
    expect(item!.priceStatus).toBe("none");
  });

  it("items は productCode 昇順で返す", async () => {
    await makeProduct(CODES.expiredOnly, "商品D");
    await makeProduct(CODES.active, "商品A");
    await makeProduct(CODES.none, "商品B");

    const dto = await queryService.find({
      customerCode: CUSTOMER_CODE,
      referenceDate: "2025-06-15",
    });
    const reserved = dto!.items
      .map((i) => i.productCode)
      .filter((c) => (Object.values(CODES) as string[]).includes(c));

    expect(reserved).toEqual([...reserved].sort());
  });

  describe("検索条件で絞り込む", () => {
    it("code は部分一致（大小無視）で絞り込む", async () => {
      await makeProduct(CODES.active, "現在有効商品");
      await makeProduct(CODES.none, "上書きなし商品");

      const dto = await queryService.find({
        customerCode: CUSTOMER_CODE,
        referenceDate: "2025-06-15",
        code: "cspls02p",
      });
      const codes = dto!.items.map((i) => i.productCode);

      expect(codes).toContain(CODES.none);
      expect(codes).not.toContain(CODES.active);
    });

    it("name は部分一致（大小無視）で絞り込む", async () => {
      await makeProduct(CODES.active, "現在有効商品");
      await makeProduct(CODES.none, "上書きなし商品");

      const dto = await queryService.find({
        customerCode: CUSTOMER_CODE,
        referenceDate: "2025-06-15",
        name: "上書きなし",
      });
      const codes = dto!.items.map((i) => i.productCode);

      expect(codes).toContain(CODES.none);
      expect(codes).not.toContain(CODES.active);
    });

    it("name の LIKE メタ文字 _ はリテラルとして扱い、ワイルドカード解釈しない（#518）", async () => {
      await makeProduct(CODES.active, "SPECIAL_ITEM"); // リテラル _ を含む→一致すべき
      await makeProduct(CODES.none, "SPECIALXITEM"); // _ をワイルドカード化した時のみ一致するデコイ

      const dto = await queryService.find({
        customerCode: CUSTOMER_CODE,
        referenceDate: "2025-06-15",
        name: "SPECIAL_ITEM",
      });
      const codes = dto!.items.map((i) => i.productCode);

      expect(codes).toContain(CODES.active);
      expect(codes).not.toContain(CODES.none);
    });

    it("priceStatus=none は上書きなしのみへ絞り込む", async () => {
      const activeId = await makeProduct(CODES.active, "現在有効商品");
      await addCustomerPrice(customerId, activeId, "2025-01-01", null, 900, "2025-01-01");
      await makeProduct(CODES.none, "上書きなし商品");

      const dto = await queryService.find({
        customerCode: CUSTOMER_CODE,
        referenceDate: "2025-06-15",
        priceStatus: "none",
      });
      const reserved = dto!.items.filter((i) =>
        (Object.values(CODES) as string[]).includes(i.productCode)
      );

      expect(reserved.map((i) => i.productCode)).toEqual([CODES.none]);
    });
  });
});
