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
import { UpdateVariationCommand } from "../UpdateVariationCommand";

// 採番年度で隔離（ファイル専用年度。割り当て一覧は UpdateEstimateCommand.test.ts 参照）
const TEST_FISCAL_YEAR = 2094;

async function cleanupTestYear(): Promise<void> {
  await prisma.estimate.deleteMany({ where: { fiscalYear: TEST_FISCAL_YEAR } });
}

describe("UpdateVariationCommand", () => {
  let command: UpdateVariationCommand;
  let createCommand: CreateEstimateCommand;
  let repository: PrismaEstimateRepository;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateRepository();
    command = new UpdateVariationCommand(
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
      estimateDate: new Date("2094-04-01T00:00:00.000Z"),
      deadline: new Date("2094-04-30T00:00:00.000Z"),
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

  it("バリエーション内容を全置換し、saved で永続化される", async () => {
    const created = await createCommand.execute(createInput());
    const variationId = created.variations[0].id.value;

    const result = await command.execute({
      estimateId: created.id.value,
      variationId,
      version: 1,
      content: {
        items: [
          {
            productId: ids.productId,
            sortOrder: 1,
            itemName: "商品B",
            quantity: 2,
            unit: "個",
            unitPrice: 500,
          },
          {
            productId: ids.productId,
            sortOrder: 2,
            itemName: "商品C",
            quantity: 1,
            unit: "個",
            unitPrice: 3000,
          },
        ],
        overallDiscount: 400,
      },
    });

    expect(result.kind).toBe("saved");

    const found = await new PrismaEstimateRepository().findById(created.id);
    const variation = found?.variations.find((v) => v.id.value === variationId);
    expect(variation?.items).toHaveLength(2);
    // 500×2 + 3000 = 4000
    expect(variation?.subtotal.majorUnits).toBe(4000);
    expect(variation?.overallDiscount.majorUnits).toBe(400);
  });

  it("無効状態のバリエーションは編集不可（§3.4・BusinessRuleViolationError）", async () => {
    const created = await createCommand.execute(createInput());
    const variationId = created.variations[0].id.value;

    // 直接ドメイン経由で無効化して永続化（C5 De/Activate はスコープ外のため）
    const loaded = await repository.findById(created.id);
    loaded!.deactivateVariation(created.variations[0].id);
    await repository.update(loaded!, 1);

    await expect(
      command.execute({
        estimateId: created.id.value,
        variationId,
        version: 2, // 直前の無効化更新で 1 → 2 に進んでいる
        content: {
          items: [
            {
              productId: ids.productId,
              sortOrder: 1,
              itemName: "X",
              quantity: 1,
              unit: "個",
              unitPrice: 100,
            },
          ],
        },
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("存在しない見積IDは NotFoundEntityError", async () => {
    await expect(
      command.execute({
        estimateId: "00000000-0000-7000-8000-0000000009ff",
        variationId: "00000000-0000-7000-8000-0000000009fe",
        version: 1,
        content: { items: [] },
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
