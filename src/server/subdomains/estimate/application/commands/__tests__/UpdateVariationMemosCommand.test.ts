import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { TaxRateConsistencyCheckDomainService } from "@subdomains/estimate/domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateNumberIssuer } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaTaxRateRepository";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CreateEstimateCommand, type CreateEstimateInput } from "../CreateEstimateCommand";
import { ReviseForCustomerCommand } from "../ReviseForCustomerCommand";
import { UpdateVariationMemosCommand } from "../UpdateVariationMemosCommand";

// 採番年度で隔離（割り当て一覧は UpdateEstimateCommand.test.ts 参照）。
// 既使用: 2099〜2092。本ファイル（C7 メモのみ更新）は未使用の 2091 を使う。
const TEST_FISCAL_YEAR = 2091;

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

describe("UpdateVariationMemosCommand", () => {
  let command: UpdateVariationMemosCommand;
  let createCommand: CreateEstimateCommand;
  let reviseCommand: ReviseForCustomerCommand;
  let repository: PrismaEstimateRepository;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateRepository();
    command = new UpdateVariationMemosCommand(repository);
    createCommand = new CreateEstimateCommand(repository, new PrismaEstimateNumberIssuer());
    reviseCommand = new ReviseForCustomerCommand(
      repository,
      new TaxRateConsistencyCheckDomainService(new PrismaTaxRateRepository())
    );
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
      estimateDate: new Date("2091-04-01T00:00:00.000Z"),
      deadline: new Date("2091-04-30T00:00:00.000Z"),
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

  it("バリ単位・明細単位のメモを適用し version 付きで永続化される", async () => {
    const created = await createCommand.execute(createInput());
    const variation = created.variations[0]!;
    const item = variation.items[0]!;

    const saved = await command.execute({
      estimateId: created.id.value,
      variationId: variation.id.value,
      version: 1,
      customerMemo: "顧客向けメモ",
      internalMemo: "社内向けメモ",
      itemMemos: [{ itemId: item.id.value, customerMemo: "明細顧客", internalMemo: "明細社内" }],
    });

    // 戻り値は採番済み・version 進行した保存済み集約
    const savedVariation = saved.variations[0]!;
    expect(savedVariation.customerMemo.value).toBe("顧客向けメモ");
    expect(savedVariation.internalMemo.value).toBe("社内向けメモ");
    expect(savedVariation.items[0]!.customerMemo.value).toBe("明細顧客");
    expect(savedVariation.items[0]!.internalMemo.value).toBe("明細社内");

    // 再読込でも永続化されている
    const reloaded = await repository.findById(new EstimateId(created.id.value));
    expect(reloaded?.variations[0]!.customerMemo.value).toBe("顧客向けメモ");
    expect(reloaded?.variations[0]!.items[0]!.internalMemo.value).toBe("明細社内");
  });

  it("凍結された改訂元でもメモのみ更新できる", async () => {
    const created = await createCommand.execute(createInput());
    const source = created.variations[0]!;
    await reviseCommand.execute({
      estimateId: created.id.value,
      sourceVariationId: source.id.value,
      version: 1,
    });

    // 改訂で version が進むため最新を取り直す（version はドメイン非公開のため read 側から）
    const current = await prisma.estimate.findUniqueOrThrow({
      where: { id: created.id.value },
      select: { version: true },
    });

    const saved = await command.execute({
      estimateId: created.id.value,
      variationId: source.id.value,
      version: current.version,
      customerMemo: "凍結中でも編集できる",
      itemMemos: [],
    });

    const savedSource = saved.variations.find((v) => v.id.equals(source.id))!;
    expect(savedSource.customerMemo.value).toBe("凍結中でも編集できる");
    // 凍結（改訂系譜）は維持されたまま
    expect(saved.variations).toHaveLength(2);
  });

  it("空文字・未指定のメモは空 Memo に正規化される", async () => {
    const created = await createCommand.execute(createInput());
    const variation = created.variations[0]!;

    const saved = await command.execute({
      estimateId: created.id.value,
      variationId: variation.id.value,
      version: 1,
      customerMemo: "",
      itemMemos: [],
    });

    expect(saved.variations[0]!.customerMemo.isEmpty()).toBe(true);
    expect(saved.variations[0]!.internalMemo.isEmpty()).toBe(true);
  });

  it("存在しない見積IDは NotFoundEntityError", async () => {
    await expect(
      command.execute({
        estimateId: "00000000-0000-7000-8000-0000000008ff",
        variationId: "00000000-0000-7000-8000-0000000008fe",
        version: 1,
        itemMemos: [],
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
