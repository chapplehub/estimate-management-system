import prisma from "@server/prisma";
import { ApplicablePeriod } from "@server/shared/domain/values/ApplicablePeriod";
import { Money } from "@server/shared/domain/values/Money";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { CommonSellingPrice } from "@subdomains/pricing/domain/entities";
import { CommonSellingPricePeriodId } from "@subdomains/pricing/domain/values/CommonSellingPricePeriodId";
import { SellingUnitPrice } from "@subdomains/pricing/domain/values/SellingUnitPrice";
import { PrismaCommonSellingPriceRepository } from "@subdomains/pricing/infrastructure/prisma/PrismaCommonSellingPriceRepository";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeleteCommonSellingPricePeriodCommand } from "../DeleteCommonSellingPricePeriodCommand";

const TEST_PRODUCT_CODE = "CSPCMD40";
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));
const period = (start: string, end: string | null) => ApplicablePeriod.create({ start, end });

async function cleanup(): Promise<void> {
  await prisma.product.deleteMany({ where: { code: TEST_PRODUCT_CODE } });
}

describe("DeleteCommonSellingPricePeriodCommand", () => {
  let command: DeleteCommonSellingPricePeriodCommand;
  let repository: PrismaCommonSellingPriceRepository;
  let productId: ProductId;

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaCommonSellingPriceRepository();
    command = new DeleteCommonSellingPricePeriodCommand(repository);

    const product = await new PrismaProductRepository().insert(
      Product.create(
        new ProductCode(TEST_PRODUCT_CODE),
        new ProductName("削除コマンドテスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      )
    );
    productId = product.id;
  });

  afterEach(cleanup);

  it("将来行を削除できる", async () => {
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2030-01-01", "2030-06-01"), price(1000), "2025-06-01");
    aggregate.addPeriod(period("2030-06-01", null), price(1200), "2025-06-01");
    await repository.insert(aggregate);
    const firstId = (await repository.findByProductId(productId))!.periods[0].id;

    await command.execute({
      productId: productId.value,
      periodId: firstId.value,
      referenceDate: "2025-06-01",
      expectedVersion: 1,
    });

    const found = await repository.findByProductId(productId);
    expect(found!.periods).toHaveLength(1);
    expect(found!.periods[0].period.equals(period("2030-06-01", null))).toBe(true);
  });

  it("集約が無い商品では NotFoundEntityError", async () => {
    await expect(
      command.execute({
        productId: productId.value,
        periodId: CommonSellingPricePeriodId.generate().value,
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(NotFoundEntityError);
  });

  it("現在有効行の削除は BusinessRuleViolationError（参照日が domain まで素通しされる）", async () => {
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2025-04-01", null), price(1000), "2025-03-01");
    await repository.insert(aggregate);
    const periodId = (await repository.findByProductId(productId))!.periods[0].id;

    await expect(
      command.execute({
        productId: productId.value,
        periodId: periodId.value,
        referenceDate: "2025-06-01",
        expectedVersion: 1,
      })
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it("expectedVersion が古いと ConflictError", async () => {
    const aggregate = CommonSellingPrice.create(productId);
    aggregate.addPeriod(period("2030-01-01", null), price(1000), "2025-06-01");
    await repository.insert(aggregate);
    const periodId = (await repository.findByProductId(productId))!.periods[0].id;

    await expect(
      command.execute({
        productId: productId.value,
        periodId: periodId.value,
        referenceDate: "2025-06-01",
        expectedVersion: 999,
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
