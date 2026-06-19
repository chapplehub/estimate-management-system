import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { PrismaEstimateNumberIssuer } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CreateEstimateCommand, type CreateEstimateInput } from "../CreateEstimateCommand";
import { DeactivateVariationCommand } from "../DeactivateVariationCommand";

// 採番年度で隔離。既使用: 2090〜2092, 2094〜2097。本ファイル（S7 無効化）は未使用の 2089 を使う。
const TEST_FISCAL_YEAR = 2089;

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

describe("DeactivateVariationCommand", () => {
  let command: DeactivateVariationCommand;
  let createCommand: CreateEstimateCommand;
  let repository: PrismaEstimateRepository;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateRepository();
    command = new DeactivateVariationCommand(repository);
    createCommand = new CreateEstimateCommand(repository, new PrismaEstimateNumberIssuer());
    await cleanupTestYear();
  });

  afterAll(async () => {
    await cleanupTestYear();
  });

  function createInput(): CreateEstimateInput {
    return {
      estimateType: "NEW",
      estimateDate: new Date(`${TEST_FISCAL_YEAR}-04-01T00:00:00.000Z`),
      deadline: new Date(`${TEST_FISCAL_YEAR}-04-30T00:00:00.000Z`),
      customerId: ids.customerId,
      deliveryLocationId: ids.deliveryLocationId,
      taxRate: 0.1,
      taxRoundingType: "ROUND_DOWN",
      createdBy: ids.employeeId,
      departmentId: ids.departmentId,
      variations: [
        {
          variationNumber: 1,
          submissionType: "DELIVERY_LOCATION",
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

  it("有効なバリエーションを無効化し version 付きで永続化される", async () => {
    const created = await createCommand.execute(createInput());
    const variation = created.variations[0]!;
    expect(variation.isActive()).toBe(true);

    const saved = await command.execute({
      estimateId: created.id.value,
      variationId: variation.id.value,
      expectedVersion: 1,
    });

    // 戻り値は status 反転・version 進行した保存済み集約
    expect(saved.variations[0]!.isActive()).toBe(false);

    // 再読込でも永続化されている
    const reloaded = await repository.findById(new EstimateId(created.id.value));
    expect(reloaded?.variations[0]!.isActive()).toBe(false);
  });

  it("stale な expectedVersion での無効化は ConflictError（ADR-0039）", async () => {
    const created = await createCommand.execute(createInput());
    const variation = created.variations[0]!;

    // 先に 1 度無効化して version を 2 へ進める
    await command.execute({
      estimateId: created.id.value,
      variationId: variation.id.value,
      expectedVersion: 1,
    });

    // 古い version=1 で再度操作すると衝突
    await expect(
      command.execute({
        estimateId: created.id.value,
        variationId: variation.id.value,
        expectedVersion: 1,
      })
    ).rejects.toThrow(ConflictError);
  });

  it("既に無効なバリエーションを無効化しても成功する（冪等・進行ロック未接続）", async () => {
    const created = await createCommand.execute(createInput());
    const variation = created.variations[0]!;

    await command.execute({
      estimateId: created.id.value,
      variationId: variation.id.value,
      expectedVersion: 1,
    });
    const saved = await command.execute({
      estimateId: created.id.value,
      variationId: variation.id.value,
      expectedVersion: 2,
    });

    expect(saved.variations[0]!.isActive()).toBe(false);
  });

  it("存在しない見積IDは NotFoundEntityError", async () => {
    await expect(
      command.execute({
        estimateId: "00000000-0000-7000-8000-0000000007ff",
        variationId: "00000000-0000-7000-8000-0000000007fe",
        expectedVersion: 1,
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
