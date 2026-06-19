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

import { AdjustRevisedVariationCommand } from "../AdjustRevisedVariationCommand";
import { CreateEstimateCommand, type CreateEstimateInput } from "../CreateEstimateCommand";
import { ReviseForCustomerCommand } from "../ReviseForCustomerCommand";

// 採番年度で隔離（割り当て一覧は UpdateEstimateCommand.test.ts 参照）。
// 既使用: 2099〜2091。本ファイル（#390 改訂先の部分編集）は未使用の 2090 を使う。
const TEST_FISCAL_YEAR = 2090;

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

describe("AdjustRevisedVariationCommand", () => {
  let command: AdjustRevisedVariationCommand;
  let createCommand: CreateEstimateCommand;
  let reviseCommand: ReviseForCustomerCommand;
  let repository: PrismaEstimateRepository;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateRepository();
    command = new AdjustRevisedVariationCommand(
      repository,
      new TaxRateConsistencyCheckDomainService(new PrismaTaxRateRepository())
    );
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

  function createInput(overrides: Partial<CreateEstimateInput> = {}): CreateEstimateInput {
    return {
      estimateType: "NEW",
      estimateDate: new Date("2090-04-01T00:00:00.000Z"),
      deadline: new Date("2090-04-30T00:00:00.000Z"),
      customerId: ids.customerId,
      deliveryLocationId: ids.deliveryLocationId,
      taxRate: 0.1,
      taxRoundingType: "ROUND_DOWN",
      createdBy: ids.employeeId,
      departmentId: ids.departmentId,
      variations: [
        {
          variationNumber: 1,
          // 改訂元になれるのは納品先宛（§7.2）
          submissionType: "DELIVERY_LOCATION",
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

  /** 改訂元を作って得意先改訂し、改訂先（revisedFrom あり）バリエーションを返す。 */
  async function buildRevisedTarget() {
    const created = await createCommand.execute(createInput());
    const source = created.variations[0]!;
    const revised = await reviseCommand.execute({
      estimateId: created.id.value,
      sourceVariationId: source.id.value,
      version: 1,
    });
    if (revised.kind !== "saved") throw new Error("改訂のセットアップに失敗");
    const target = revised.estimate.variations.find((v) => v.revisedFrom !== null)!;
    // 改訂で version が進むため最新を取り直す
    const current = await prisma.estimate.findUniqueOrThrow({
      where: { id: created.id.value },
      select: { version: true },
    });
    return { estimateId: created.id.value, target, version: current.version };
  }

  it("改訂先の単価・掛率・明細値引・全体値引とメモを適用し saved で永続化される", async () => {
    const { estimateId, target, version } = await buildRevisedTarget();
    const item = target.items[0]!;

    const result = await command.execute({
      estimateId,
      variationId: target.id.value,
      version,
      overallDiscount: 50,
      customerMemo: "得意先向けメモ",
      internalMemo: "社内向けメモ",
      items: [
        {
          itemId: item.id.value,
          unitPrice: 1500,
          discountRate: 1.0,
          itemDiscount: 100,
          customerMemo: "明細顧客",
          internalMemo: "明細社内",
        },
      ],
    });

    expect(result.kind).toBe("saved");
    if (result.kind !== "saved") return;

    const saved = result.estimate.variations.find((v) => v.id.equals(target.id))!;
    const savedItem = saved.items[0]!;
    // item: base 1500*2=3000, 掛率1.0, 値引100 → final 2900
    expect(savedItem.unitPrice.majorUnits).toBe(1500);
    expect(savedItem.finalAmount.majorUnits).toBe(2900);
    expect(saved.overallDiscount.majorUnits).toBe(50);
    expect(saved.customerMemo.value).toBe("得意先向けメモ");
    expect(savedItem.customerMemo.value).toBe("明細顧客");
    // 数量は不変（数量固定・ADR-0060）
    expect(savedItem.quantity.value).toBe(2);

    // 再読込でも永続化されている
    const reloaded = await repository.findById(new EstimateId(estimateId));
    expect(reloaded).not.toBeNull();
    const reloadedTarget = reloaded!.variations.find((v) => v.id.equals(target.id))!;
    expect(reloadedTarget.items[0]!.finalAmount.majorUnits).toBe(2900);
    expect(reloadedTarget.overallDiscount.majorUnits).toBe(50);
  });

  it("税率不一致なら taxRateMismatch を返し、保存されない（§8.7）", async () => {
    // 見積年月日=2019-09-01(8%) / 締切日=2019-11-01(10%) で税率改定境界を跨ぐ見積を作る。
    // fiscalYear は estimateDate=2019 から決まるが、本テスト専用に隔離した CUSTOMER 単独バリ。
    const created = await createCommand.execute(
      createInput({
        estimateDate: new Date("2019-09-01T00:00:00+09:00"),
        deadline: new Date("2019-11-01T00:00:00+09:00"),
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
      })
    );
    const variation = created.variations[0]!;
    const item = variation.items[0]!;

    const result = await command.execute({
      estimateId: created.id.value,
      variationId: variation.id.value,
      version: 1,
      overallDiscount: 0,
      items: [{ itemId: item.id.value, unitPrice: 2000, discountRate: 1.0, itemDiscount: 0 }],
    });

    expect(result.kind).toBe("taxRateMismatch");

    // 未保存: 単価は元の 1000 のまま
    const reloaded = await repository.findById(created.id);
    expect(reloaded?.variations[0]!.items[0]!.unitPrice.majorUnits).toBe(1000);

    // 2019 帯に作った見積はテスト後に掃除する（cleanupTestYear は 2090 のみ対象のため）
    await prisma.estimate.delete({ where: { id: created.id.value } });
  });

  it("存在しない見積IDは NotFoundEntityError", async () => {
    await expect(
      command.execute({
        estimateId: "00000000-0000-7000-8000-0000000007ff",
        variationId: "00000000-0000-7000-8000-0000000007fe",
        version: 1,
        overallDiscount: 0,
        items: [],
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
