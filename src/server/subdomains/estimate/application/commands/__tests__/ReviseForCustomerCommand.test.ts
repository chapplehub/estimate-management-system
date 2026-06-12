import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateNumberIssuer } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaTaxRateRepository";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CreateEstimateCommand, type CreateEstimateInput } from "../CreateEstimateCommand";
import { ReviseForCustomerCommand } from "../ReviseForCustomerCommand";

// 採番年度で隔離（ファイル専用年度。割り当て一覧は UpdateEstimateCommand.test.ts 参照）。
// 既使用: 2099〜2093。本ファイル（C7 ReviseForCustomer）は 2092 を使う。
const TEST_FISCAL_YEAR = 2092;

async function cleanupTestYear(): Promise<void> {
  // 改訂系譜を先に削除する（source 側参照は cascade されないため・ADR-0044）
  const ests = await prisma.estimate.findMany({
    where: { fiscalYear: TEST_FISCAL_YEAR },
    select: { variations: { select: { id: true } } },
  });
  const variationIds = ests.flatMap((e) => e.variations.map((v) => v.id));
  if (variationIds.length > 0) {
    await prisma.estimateVariationRevision.deleteMany({
      where: { sourceVariationId: { in: variationIds } },
    });
  }
  await prisma.estimate.deleteMany({ where: { fiscalYear: TEST_FISCAL_YEAR } });
}

describe("ReviseForCustomerCommand", () => {
  let command: ReviseForCustomerCommand;
  let createCommand: CreateEstimateCommand;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    const repository = new PrismaEstimateRepository();
    command = new ReviseForCustomerCommand(
      repository,
      new TaxRateConsistencyCheckDomainService(new PrismaTaxRateRepository())
    );
    createCommand = new CreateEstimateCommand(repository, new PrismaEstimateNumberIssuer());
    await cleanupTestYear();
  });

  afterAll(async () => {
    await cleanupTestYear();
  });

  function createInput(
    submissionType: "CUSTOMER" | "DELIVERY_LOCATION" = "DELIVERY_LOCATION"
  ): CreateEstimateInput {
    return {
      estimateType: "NEW",
      estimateDate: new Date("2092-04-01T00:00:00.000Z"),
      deadline: new Date("2092-04-30T00:00:00.000Z"),
      customerId: ids.customerId,
      deliveryLocationId: ids.deliveryLocationId,
      taxRate: 0.1,
      taxRoundingType: "ROUND_DOWN",
      createdBy: ids.employeeId,
      departmentId: ids.departmentId,
      variations: [
        {
          variationNumber: 1,
          submissionType,
          items: [
            {
              productId: ids.productId,
              sortOrder: 1,
              itemName: "商品A",
              quantity: 2,
              unit: "個",
              unitPrice: 600000,
            },
          ],
        },
      ],
    };
  }

  it("納品先宛バリエーションを改訂し、得意先宛の新バリエーションと系譜が永続化される", async () => {
    const created = await createCommand.execute(createInput());
    const source = created.variations[0]!;

    const result = await command.execute({
      estimateId: created.id.value,
      sourceVariationId: source.id.value,
      version: 1,
    });

    expect(result.kind).toBe("saved");
    if (result.kind !== "saved") return;

    expect(result.estimate.variations).toHaveLength(2);
    const revised = result.estimate.variations.find((v) => v.variationNumber === 2);
    expect(revised).toBeDefined();
    // 得意先宛・出自=改訂元
    expect(revised?.submissionType.isCustomer()).toBe(true);
    expect(revised?.revisedFrom?.value).toBe(source.id.value);
    // 全複写: 改訂直後は改訂元と同額（調整の出発点・§7.2）
    expect(revised?.subtotal.minorUnits).toBe(source.subtotal.minorUnits);
    // 全明細に deliveryPrice スナップショット（§8.4）
    expect(revised?.items.length).toBeGreaterThan(0);
    expect(revised?.items.every((i) => i.revisedDetail !== null)).toBe(true);
  });

  it("得意先宛バリエーションを改訂元に指定するとドメインエラーが透過する", async () => {
    const created = await createCommand.execute(createInput("CUSTOMER"));

    await expect(
      command.execute({
        estimateId: created.id.value,
        sourceVariationId: created.variations[0]!.id.value,
        version: 1,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("存在しない見積IDは NotFoundEntityError", async () => {
    await expect(
      command.execute({
        estimateId: "00000000-0000-7000-8000-0000000009ff",
        sourceVariationId: "00000000-0000-7000-8000-0000000009fe",
        version: 1,
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
