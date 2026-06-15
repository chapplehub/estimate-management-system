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
import { ReviseForCustomerCommand } from "../ReviseForCustomerCommand";
import { UpdateEstimateCommand, type UpdateEstimateInput } from "../UpdateEstimateCommand";

// 採番年度で隔離。テストファイルはvitestで並列実行されるため、ファイルごとに専用年度を割り当てる
// （リポジトリ=2099 / 採番=2098 / C1=2097 / C2=2096 / C3=2095 / C4=2094）。年度共有はcleanupと採番が衝突する。
const TEST_FISCAL_YEAR = 2096;

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

describe("UpdateEstimateCommand", () => {
  let command: UpdateEstimateCommand;
  let createCommand: CreateEstimateCommand;
  let reviseCommand: ReviseForCustomerCommand;
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
    reviseCommand = new ReviseForCustomerCommand(repository, taxRateConsistencyCheck);
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
      customerId: ids.customerId,
      deliveryLocationId: ids.deliveryLocationId,
      departmentId: ids.departmentId,
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

  it("修理情報（事前）を C2 で更新でき、永続化される（changeRepairDetail 委譲）", async () => {
    const created = await createCommand.execute(
      createInput({
        estimateType: "REPAIR",
        repairDetail: {
          targetProductId: ids.productId,
          faultDescription: "初期故障",
          scheduledRepairDate: new Date("2096-05-01T00:00:00.000Z"),
        },
      })
    );

    const result = await command.execute(
      updateInput(created.id.value, {
        repairDetail: {
          targetProductId: ids.setProductId,
          faultDescription: "更新後の故障",
          scheduledRepairDate: new Date("2096-06-15T00:00:00.000Z"),
        },
      })
    );

    expect(result.kind).toBe("saved");

    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.repairDetail?.targetProductId.value).toBe(ids.setProductId);
    expect(found?.repairDetail?.faultDescription.value).toBe("更新後の故障");
    expect(found?.repairDetail?.scheduledRepairDate.toISOString()).toBe("2096-06-15T00:00:00.000Z");
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

  it("改訂が存在する見積でもフォーム全項目送信で締切日を更新できる（ADR-0049 欠陥修正）", async () => {
    // 納品先宛バリエーションを持つ見積を作成し、得意先改訂して凍結状態にする
    const created = await createCommand.execute(
      createInput({
        variations: [
          {
            variationNumber: 1,
            submissionType: "DELIVERY_LOCATION",
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
      })
    );
    const revised = await reviseCommand.execute({
      estimateId: created.id.value,
      sourceVariationId: created.variations[0]!.id.value,
      version: 1,
    });
    expect(revised.kind).toBe("saved");

    // フォームは全ヘッダー項目を送る。ロック項目（見積年月日・得意先・納品先・端数）は
    // 現在値と同値なので no-op で素通りし、締切日だけが実変更される（ADR-0049）。
    // ADR-0049 以前は changeEstimateDate(同値) が assertHeaderMutable で throw していた。
    const result = await command.execute(
      updateInput(created.id.value, {
        version: 2,
        deadline: new Date("2096-07-31T00:00:00.000Z"),
      })
    );

    expect(result.kind).toBe("saved");
    const found = await new PrismaEstimateRepository().findById(created.id);
    expect(found?.deadline.toISOString()).toBe("2096-07-31T00:00:00.000Z");
  });
});
