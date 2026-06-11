import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateNumberIssuer } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaTaxRateRepository";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CreateEstimateCommand, type CreateEstimateInput } from "../CreateEstimateCommand";
import { UpdateEstimateCommand, type UpdateEstimateInput } from "../UpdateEstimateCommand";

// 採番年度で隔離。テストファイルはvitestで並列実行されるため、ファイルごとに専用年度を割り当てる
// （リポジトリ=2099 / 採番=2098 / C1=2097 / C2=2096 / C3=2095 / C4=2094）。年度共有はcleanupと採番が衝突する。
const TEST_FISCAL_YEAR = 2096;

async function cleanupTestYear(): Promise<void> {
  await prisma.estimate.deleteMany({ where: { fiscalYear: TEST_FISCAL_YEAR } });
}

describe("UpdateEstimateCommand", () => {
  let command: UpdateEstimateCommand;
  let createCommand: CreateEstimateCommand;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    const repository = new PrismaEstimateRepository();
    const taxRateConsistencyCheck = new TaxRateConsistencyCheckDomainService(
      new PrismaTaxRateRepository()
    );
    command = new UpdateEstimateCommand(repository, taxRateConsistencyCheck);
    createCommand = new CreateEstimateCommand(repository, new PrismaEstimateNumberIssuer());
    await cleanupTestYear();
  });

  afterAll(async () => {
    await cleanupTestYear();
  });

  function createInput(overrides: Partial<CreateEstimateInput> = {}): CreateEstimateInput {
    return {
      estimateType: "NEW",
      estimateDate: new Date("2096-04-01T00:00:00.000Z"),
      deadline: new Date("2096-04-30T00:00:00.000Z"),
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
          ],
        },
      ],
      ...overrides,
    };
  }

  function updateInput(
    estimateId: string,
    overrides: Partial<UpdateEstimateInput> = {}
  ): UpdateEstimateInput {
    return {
      estimateId,
      version: 1, // 作成直後の集約は version 1（個々のテストで先行更新する場合は上書き）
      estimateDate: new Date("2096-04-01T00:00:00.000Z"),
      deadline: new Date("2096-04-30T00:00:00.000Z"),
      submissionType: "CUSTOMER",
      customerId: ids.customerId,
      deliveryLocationId: ids.deliveryLocationId,
      departmentId: ids.departmentId,
      taxRate: 0.1,
      taxRoundingType: "ROUND_DOWN",
      ...overrides,
    };
  }

  it("ヘッダを更新でき、税率一致なら saved を返して永続化される", async () => {
    const created = await createCommand.execute(createInput());

    const result = await command.execute(
      updateInput(created.id.value, { deadline: new Date("2096-05-31T00:00:00.000Z") })
    );

    expect(result.kind).toBe("saved");

    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.deadline.toISOString()).toBe("2096-05-31T00:00:00.000Z");
  });

  it("estimateType は更新対象外で変化しない", async () => {
    const created = await createCommand.execute(createInput({ estimateType: "NEW" }));

    await command.execute(updateInput(created.id.value));

    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.estimateType.value).toBe("NEW");
  });

  it("税率不一致なら taxRateMismatch を返し、保存されない（§8.7）", async () => {
    const created = await createCommand.execute(createInput());

    // 見積年月日=2019-09-01(8%) / 締切日=2019-11-01(10%) で税率改定境界を跨ぐ
    const result = await command.execute(
      updateInput(created.id.value, {
        estimateDate: new Date("2019-09-01T00:00:00+09:00"),
        deadline: new Date("2019-11-01T00:00:00+09:00"),
      })
    );

    expect(result.kind).toBe("taxRateMismatch");

    // 未保存: 元の見積年月日(2096-04-01)のまま
    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.estimateDate.toISOString()).toBe("2096-04-01T00:00:00.000Z");
  });

  it("存在しない見積IDは NotFoundEntityError", async () => {
    await expect(
      command.execute(updateInput("00000000-0000-7000-8000-0000000009ff"))
    ).rejects.toThrow(NotFoundEntityError);
  });

  it("古い version での更新は ConflictError になり、先行の変更は失われない（楽観ロック / ADR-0039）", async () => {
    const created = await createCommand.execute(createInput());

    // 先行更新が version 1 → 2 に進める
    await command.execute(
      updateInput(created.id.value, {
        version: 1,
        deadline: new Date("2096-05-31T00:00:00.000Z"),
      })
    );

    // 古い画面（version 1）からの保存は競合として弾かれる
    await expect(
      command.execute(
        updateInput(created.id.value, {
          version: 1,
          deadline: new Date("2096-06-30T00:00:00.000Z"),
        })
      )
    ).rejects.toThrow(ConflictError);

    // 先行更新の内容が残っている（lost update が起きていない）
    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.deadline.toISOString()).toBe("2096-05-31T00:00:00.000Z");
  });
});
