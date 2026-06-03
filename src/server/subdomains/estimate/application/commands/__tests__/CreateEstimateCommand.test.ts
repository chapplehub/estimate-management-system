import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { PrismaEstimateNumberIssuer } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CreateEstimateCommand, type CreateEstimateInput } from "../CreateEstimateCommand";

// 採番は「年度 × 種別の全行」を集約対象とするため年度単位で隔離する。
// 2097 は他テスト（リポジトリ=2099 / 採番=2098 帯）・実シードと衝突しない未使用年度。
// estimateDate を 2097-04-01（JST で 2097 年度）とすることで採番年度が 2097 に固定される。
const TEST_FISCAL_YEAR = 2097;

async function cleanupTestYear(): Promise<void> {
  await prisma.estimate.deleteMany({ where: { fiscalYear: TEST_FISCAL_YEAR } });
}

describe("CreateEstimateCommand", () => {
  let command: CreateEstimateCommand;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    command = new CreateEstimateCommand(
      new PrismaEstimateRepository(),
      new PrismaEstimateNumberIssuer()
    );
    await cleanupTestYear();
  });

  afterAll(async () => {
    await cleanupTestYear();
  });

  function baseInput(overrides: Partial<CreateEstimateInput> = {}): CreateEstimateInput {
    return {
      estimateType: "NEW",
      estimateDate: new Date("2097-04-01T00:00:00.000Z"),
      deadline: new Date("2097-04-30T00:00:00.000Z"),
      submissionType: "CUSTOMER",
      customerId: ids.customerId,
      deliveryLocationId: ids.deliveryLocationId,
      taxRate: 0.1,
      taxRoundingType: "ROUND_DOWN",
      createdBy: ids.employeeId,
      departmentId: ids.departmentId,
      variations: [
        {
          variationNumber: 1,
          items: [
            {
              productId: ids.productId,
              sortOrder: 1,
              itemName: "商品A",
              quantity: 2,
              unit: "個",
              unitPrice: 1000,
            },
            {
              productId: ids.productId,
              sortOrder: 2,
              itemName: "商品B",
              quantity: 1,
              unit: "個",
              unitPrice: 500,
              revisedDeliveryPrice: 800,
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  it("NEW: 採番（連番1）され、金額集計と明細・改訂明細詳細が永続化される", async () => {
    const created = await command.execute(baseInput());

    // 採番結果（保存時採番 §2.3・MAX+1 で連番1）
    expect(created.estimateNumber.value).toBe("N9700001");
    expect(created.fiscalYear.value).toBe(TEST_FISCAL_YEAR);
    expect(created.sequence).toBe(1);

    // DB から再取得して永続化を確認
    const repository = new PrismaEstimateRepository();
    const found = await repository.findById(created.id);
    expect(found).not.toBeNull();
    if (!found) return;

    expect(found.estimateType.value).toBe("NEW");
    expect(found.variations).toHaveLength(1);
    const variation = found.variations[0];
    // 1000*2 + 500*1 = 2500
    expect(variation.subtotal.majorUnits).toBe(2500);
    expect(variation.items).toHaveLength(2);
    expect(variation.items[1].revisedDetail?.deliveryPrice.majorUnits).toBe(800);
  });

  it("連続作成で連番が +1 される（保存時採番 §2.3・MAX+1）", async () => {
    const first = await command.execute(baseInput());
    const second = await command.execute(baseInput());

    expect(first.estimateNumber.value).toBe("N9700001");
    expect(second.estimateNumber.value).toBe("N9700002");
    expect(second.sequence).toBe(2);
  });

  it("REPAIR: repairDetail を伴って作成・永続化でき、種別ごとに連番1から採番される", async () => {
    const created = await command.execute(
      baseInput({
        estimateType: "REPAIR",
        repairDetail: {
          targetProductId: ids.productId,
          faultDescription: "電源が入らない",
          scheduledRepairDate: new Date("2097-05-10T00:00:00.000Z"),
        },
      })
    );

    expect(created.estimateNumber.value).toBe("R9700001");

    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.estimateType.value).toBe("REPAIR");
    expect(found?.repairDetail?.faultDescription.value).toBe("電源が入らない");
    expect(found?.afterRepairDetail).toBeNull();
  });

  it("AFTER_REPAIR: afterRepairDetail を伴って作成・永続化できる", async () => {
    const created = await command.execute(
      baseInput({
        estimateType: "AFTER_REPAIR",
        afterRepairDetail: {
          targetProductId: ids.productId,
          faultDescription: "基板焼損",
          actualRepairDate: new Date("2097-03-20T00:00:00.000Z"),
          emergencyReason: "顧客ライン停止のため緊急対応",
        },
      })
    );

    expect(created.estimateNumber.value).toBe("A9700001");

    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.estimateType.value).toBe("AFTER_REPAIR");
    expect(found?.afterRepairDetail?.emergencyReason.value).toBe("顧客ライン停止のため緊急対応");
    expect(found?.repairDetail).toBeNull();
  });

  it("バリエーション0件は空見積不可で BusinessRuleViolationError", async () => {
    await expect(command.execute(baseInput({ variations: [] }))).rejects.toThrow(
      BusinessRuleViolationError
    );
  });
});
