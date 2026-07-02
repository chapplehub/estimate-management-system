import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { CostPrice } from "@subdomains/pricing/domain/entities";
import { CostPricePeriodId } from "@subdomains/pricing/domain/values/CostPricePeriodId";
import { CostUnitPrice } from "@subdomains/pricing/domain/values/CostUnitPrice";
import { PrismaCostPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCostPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EndDateCostPricePeriodCommand } from "../EndDateCostPricePeriodCommand";

const TEST_PRODUCT_CODE = "CPCMD30";
const cost = (yen: number) => CostUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
}

describe("EndDateCostPricePeriodCommand", () => {
  let command: EndDateCostPricePeriodCommand;
  let repository: PrismaCostPriceRepository;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaCostPriceRepository();
    command = new EndDateCostPricePeriodCommand(repository);

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName(`適用終了コマンドテスト商品${TEST_PRODUCT_CODE}`),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(cleanup);

  /** 現在有効な無期限行を1本持つ集約を用意し、その periodId を返す。 */
  async function seedActivePeriod(): Promise<CostPricePeriodId> {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2025-04-01", null), cost(1000), "2025-03-01");
    await repository.insert(aggregate);
    return (await repository.findByProductId(productId))!.periods[0].id;
  }

  it("現在有効行に終了日を設定できる（適用終了）", async () => {
    const periodId = await seedActivePeriod();

    await command.execute({
      productId: productId.value,
      periodId: periodId.value,
      endDate: "2030-01-01",
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByProductId(productId);
    expect(found!.periods[0].period.equals(period("2025-04-01", "2030-01-01"))).toBe(true);
  });

  it("集約が無い商品では NotFoundEntityError", async () => {
    await expect(
      command.execute({
        productId: productId.value,
        periodId: CostPricePeriodId.generate().value,
        endDate: "2030-01-01",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(NotFoundEntityError);
  });

  it("将来行への適用終了は BusinessRuleViolationError（参照日が domain まで素通しされる）", async () => {
    const aggregate = CostPrice.create(productId);
    aggregate.addPeriod(period("2030-01-01", null), cost(1000), "2025-06-01");
    await repository.insert(aggregate);
    const periodId = (await repository.findByProductId(productId))!.periods[0].id;

    await expect(
      command.execute({
        productId: productId.value,
        periodId: periodId.value,
        endDate: "2031-01-01",
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("expectedVersion が古いと ConflictError", async () => {
    const periodId = await seedActivePeriod();

    await expect(
      command.execute({
        productId: productId.value,
        periodId: periodId.value,
        endDate: "2030-01-01",
        referenceDate: "2025-06-01",
        expectedVersion: 999,
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
