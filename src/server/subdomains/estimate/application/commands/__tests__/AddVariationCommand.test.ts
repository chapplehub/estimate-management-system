import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateNumberIssuer } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaTaxRateRepository";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CreateEstimateCommand, type CreateEstimateInput } from "../CreateEstimateCommand";
import { AddVariationCommand } from "../AddVariationCommand";

// 採番年度で隔離（ファイル専用年度。割り当て一覧は UpdateEstimateCommand.test.ts 参照）
const TEST_FISCAL_YEAR = 2095;

async function cleanupTestYear(): Promise<void> {
  await prisma.estimate.deleteMany({ where: { fiscalYear: TEST_FISCAL_YEAR } });
}

describe("AddVariationCommand", () => {
  let command: AddVariationCommand;
  let createCommand: CreateEstimateCommand;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    const repository = new PrismaEstimateRepository();
    command = new AddVariationCommand(
      repository,
      new TaxRateConsistencyCheckDomainService(new PrismaTaxRateRepository())
    );
    createCommand = new CreateEstimateCommand(repository, new PrismaEstimateNumberIssuer());
    await cleanupTestYear();
  });

  afterAll(async () => {
    await cleanupTestYear();
  });

  function createInput(overrides: Partial<CreateEstimateInput> = {}): CreateEstimateInput {
    return {
      estimateType: "NEW",
      estimateDate: new Date("2095-04-01T00:00:00.000Z"),
      deadline: new Date("2095-04-30T00:00:00.000Z"),
      customerId: ids.customerId,
      deliveryLocationId: ids.deliveryLocationId,
      taxRate: 0.1,
      taxRoundingType: "ROUND_DOWN",
      createdBy: ids.employeeId,
      departmentId: ids.departmentId,
      variations: [
        {
          variationNumber: 1,
          submissionType: "CUSTOMER",
          items: [
            {
              productId: ids.productId,
              sortOrder: 1,
              itemName: "商品A",
              quantity: 1,
              unit: "個",
              unitPrice: 1000,
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  it("max+1 採番した新バリエーションを追加し、saved で永続化される", async () => {
    const created = await createCommand.execute(createInput());

    const result = await command.execute({
      estimateId: created.id.value,
      version: 1,
      // 既存バリエーション（得意先宛）と異なる区分を指定し、同一見積内の共存を検証する（ADR-0045）
      submissionType: "DELIVERY_LOCATION",
      content: {
        items: [
          {
            productId: ids.productId,
            sortOrder: 1,
            itemName: "商品B",
            quantity: 2,
            unit: "個",
            unitPrice: 1500,
          },
        ],
      },
    });

    expect(result.kind).toBe("saved");

    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.variations).toHaveLength(2);
    const added = found?.variations.find((v) => v.variationNumber === 2);
    // 1500 × 2 = 3000
    expect(added?.subtotal.majorUnits).toBe(3000);
    expect(added?.submissionType.isDeliveryLocation()).toBe(true);
    expect(
      found?.variations.find((v) => v.variationNumber === 1)?.submissionType.isCustomer()
    ).toBe(true);
  });

  it("存在しない見積IDは NotFoundEntityError", async () => {
    await expect(
      command.execute({
        estimateId: "00000000-0000-7000-8000-0000000009ff",
        version: 1,
        submissionType: "CUSTOMER",
        content: { items: [] },
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
