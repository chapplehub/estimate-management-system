import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
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
import { EndDateCustomerSellingPricePeriodCommand } from "../EndDateCustomerSellingPricePeriodCommand";
import { ReviseCustomerSellingPricePeriodCommand } from "../ReviseCustomerSellingPricePeriodCommand";

const TEST_PRODUCT_CODE = "CUSPCMD50";
const TEST_CUSTOMER_CODE = "CUSPCMD51";
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
  await prisma.customer.deleteMany({ where: { code: TEST_CUSTOMER_CODE } });
}

describe("ReviseCustomerSellingPricePeriodCommand", () => {
  let command: ReviseCustomerSellingPricePeriodCommand;
  let repository: PrismaCustomerSellingPriceRepository;
  let customerId: CustomerId;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaCustomerSellingPriceRepository();
    command = new ReviseCustomerSellingPricePeriodCommand(repository);

    const customer = await new PrismaCustomerRepository().insert(
      Customer.create(
        new CompanyCode(TEST_CUSTOMER_CODE),
        new CompanyName("単価改定コマンドテスト得意先")
      )
    );
    customerId = customer.id;

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("単価改定コマンドテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(cleanup);

  /** 現在有効な無期限行（2025-04-01〜・1000円）を1本持つ集約を用意する。 */
  async function seedActivePeriod(): Promise<void> {
    const aggregate = CustomerSellingPrice.create(customerId, productId);
    aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");
    await repository.insert(aggregate);
  }

  it("現在有効行を改定日で終了し、改定日開始の新行を連続して追加する", async () => {
    await seedActivePeriod();

    await command.execute({
      customerId: customerId.value,
      productId: productId.value,
      revisionDate: "2025-09-01",
      price: "1200",
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByCustomerIdAndProductId(customerId, productId);
    const rows = [...found!.periods].sort((a, b) => a.period.start.localeCompare(b.period.start));
    expect(rows).toHaveLength(2);
    // 旧行: 改定日で終了、単価据え置き
    expect(rows[0].period.equals(period("2025-04-01", "2025-09-01"))).toBe(true);
    expect(rows[0].price.equals(price(1000))).toBe(true);
    // 新行: 改定日開始の無期限、新単価
    expect(rows[1].period.equals(period("2025-09-01", null))).toBe(true);
    expect(rows[1].price.equals(price(1200))).toBe(true);
  });

  it("現在有効行が無い得意先×商品（将来行のみ）は BusinessRuleViolationError", async () => {
    const aggregate = CustomerSellingPrice.create(customerId, productId);
    aggregate.addPeriod(period("2025-12-01", null), price(1000), "2025-06-01");
    await repository.insert(aggregate);

    await expect(
      command.execute({
        customerId: customerId.value,
        productId: productId.value,
        revisionDate: "2026-01-01",
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("集約が無い得意先×商品（未設定）は NotFoundEntityError", async () => {
    await expect(
      command.execute({
        customerId: customerId.value,
        productId: productId.value,
        revisionDate: "2025-09-01",
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(NotFoundEntityError);
  });

  it("改定日が今日以前なら BusinessRuleViolationError（適用終了ガード由来・遡及改竄を閉じる）", async () => {
    await seedActivePeriod();

    await expect(
      command.execute({
        customerId: customerId.value,
        productId: productId.value,
        revisionDate: "2025-06-01", // = referenceDate（今日）
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);

    // 失敗時は集約が変わらない（部分適用なし）
    const found = await repository.findByCustomerIdAndProductId(customerId, productId);
    expect(found!.periods).toHaveLength(1);
    expect(found!.periods[0].period.equals(period("2025-04-01", null))).toBe(true);
  });

  it("据え置き（新単価＝現単価）も改定として成立する（拒否しない）", async () => {
    await seedActivePeriod();

    await command.execute({
      customerId: customerId.value,
      productId: productId.value,
      revisionDate: "2025-09-01",
      price: "1000", // 現単価と同一
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByCustomerIdAndProductId(customerId, productId);
    const rows = [...found!.periods].sort((a, b) => a.period.start.localeCompare(b.period.start));
    expect(rows).toHaveLength(2);
    expect(rows[1].period.equals(period("2025-09-01", null))).toBe(true);
    expect(rows[1].price.equals(price(1000))).toBe(true);
  });

  it("expectedVersion が古いと ConflictError（部分適用なし）", async () => {
    await seedActivePeriod();

    await expect(
      command.execute({
        customerId: customerId.value,
        productId: productId.value,
        revisionDate: "2025-09-01",
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 999,
      })
    ).rejects.toBeInstanceOf(ConflictError);

    const found = await repository.findByCustomerIdAndProductId(customerId, productId);
    expect(found!.periods).toHaveLength(1);
  });

  it("改定日開始の新行が既存の将来行と重複すると BusinessRuleViolationError", async () => {
    const aggregate = CustomerSellingPrice.create(customerId, productId);
    aggregate.addPeriod(period("2025-04-01", "2025-10-01"), price(1000), "2025-03-01");
    aggregate.addPeriod(period("2025-10-01", null), price(1100), "2025-03-01");
    await repository.insert(aggregate);

    await expect(
      command.execute({
        customerId: customerId.value,
        productId: productId.value,
        revisionDate: "2025-09-01",
        price: "1200",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);

    const found = await repository.findByCustomerIdAndProductId(customerId, productId);
    expect(found!.periods).toHaveLength(2);
  });

  it("version は改定1回につき1度だけ上がる（後続操作が expectedVersion=2 で通り 1 で弾かれる）", async () => {
    await seedActivePeriod();

    await command.execute({
      customerId: customerId.value,
      productId: productId.value,
      revisionDate: "2025-09-01",
      price: "1200",
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const endDate = new EndDateCustomerSellingPricePeriodCommand(repository);
    const currentId = (await repository.findByCustomerIdAndProductId(
      customerId,
      productId
    ))!.periods.find((r) => r.period.contains("2025-06-01"))!.id.value;

    await expect(
      endDate.execute({
        customerId: customerId.value,
        productId: productId.value,
        periodId: currentId,
        endDate: "2025-08-01",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(ConflictError);

    await expect(
      endDate.execute({
        customerId: customerId.value,
        productId: productId.value,
        periodId: currentId,
        endDate: "2025-08-01",
        referenceDate: "2025-06-01",
        expectedVersion: 2,
      })
    ).resolves.toBeDefined();
  });
});
