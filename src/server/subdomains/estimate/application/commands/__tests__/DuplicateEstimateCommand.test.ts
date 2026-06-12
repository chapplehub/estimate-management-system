import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { Estimate, EstimateFactory } from "@subdomains/estimate/domain/entities";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { ItemName } from "@subdomains/estimate/domain/values/ItemName";
import { Money } from "@subdomains/estimate/domain/values/Money";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { TaxRoundingType } from "@subdomains/estimate/domain/values/TaxRoundingType";
import { Unit } from "@subdomains/estimate/domain/values/Unit";
import { PrismaEstimateNumberIssuer } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DuplicateEstimateCommand, type DuplicateEstimateInput } from "../DuplicateEstimateCommand";

// 採番は「年度 × 種別の全行」を集約対象とするため、テストファイルごとに専用年度で隔離する
// （vitest はファイル並列実行のため、年度を共有すると cleanup と採番が衝突する）。
// 既使用: 2099=Repository / 2098=NumberIssuer / 2097=Create / 2096=Update / 2095=AddVariation /
// 2094=UpdateVariation。本ファイル（Duplicate）は未使用の 2093 を使う。
const FY = 2093;
const SOURCE_DATE = new Date("2093-04-01T00:00:00.000Z");

async function cleanupTestYear(): Promise<void> {
  // 複製系譜を先に削除（source 側参照は cascade されないため）。
  const ests = await prisma.estimate.findMany({
    where: { fiscalYear: FY },
    select: { variations: { select: { id: true } } },
  });
  const variationIds = ests.flatMap((e) => e.variations.map((v) => v.id));
  if (variationIds.length > 0) {
    await prisma.estimateVariationCopy.deleteMany({
      where: {
        OR: [
          { copiedVariationId: { in: variationIds } },
          { sourceVariationId: { in: variationIds } },
        ],
      },
    });
  }
  await prisma.estimate.deleteMany({ where: { fiscalYear: FY } });
}

describe("DuplicateEstimateCommand", () => {
  let command: DuplicateEstimateCommand;
  let repository: PrismaEstimateRepository;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateRepository();
    command = new DuplicateEstimateCommand(repository, new PrismaEstimateNumberIssuer());
    await cleanupTestYear();
  });

  afterAll(async () => {
    await cleanupTestYear();
  });

  /** 複製元 NEW 見積（2 バリエーション、単価あり）を生成する。 */
  function buildSource(): Estimate {
    const variation = (variationNumber: number, itemName: string, unitPrice: number) => ({
      variationNumber,
      submissionType: SubmissionType.CUSTOMER,
      items: [
        {
          productId: new ProductId(ids.productId),
          sortOrder: 1,
          itemName: new ItemName(itemName),
          quantity: new Quantity(2),
          unit: new Unit("個"),
          unitPrice: Money.fromMajorUnits(unitPrice),
        },
      ],
    });
    return EstimateFactory.create({
      estimateNumber: EstimateNumber.parse("N9300001"),
      estimateDate: SOURCE_DATE,
      deadline: new Date("2093-04-30T00:00:00.000Z"),
      customerId: new CustomerId(ids.customerId),
      deliveryLocationId: new DeliveryLocationId(ids.deliveryLocationId),
      taxRate: new TaxRate(0.1),
      taxRoundingType: TaxRoundingType.ROUND_DOWN,
      createdBy: new EmployeeId(ids.employeeId),
      departmentId: new DepartmentId(ids.departmentId),
      variations: [variation(1, "商品A", 1000), variation(2, "商品B", 500)],
    });
  }

  function baseInput(
    source: Estimate,
    overrides: Partial<DuplicateEstimateInput> = {}
  ): DuplicateEstimateInput {
    return {
      sourceEstimateId: source.id.value,
      selectedVariationIds: source.variations.map((v) => v.id.value),
      estimateDate: SOURCE_DATE,
      deadline: new Date("2093-06-30T00:00:00.000Z"),
      taxRate: 0.1,
      createdBy: ids.employeeId,
      departmentId: ids.departmentId,
      ...overrides,
    };
  }

  it("複製元と同種別で新採番し、選択順を保持して複製・系譜を保存する", async () => {
    const source = await repository.insert(buildSource());

    // 逆順に選択して複製
    const result = await command.execute(
      baseInput(source, {
        selectedVariationIds: [source.variations[1].id.value, source.variations[0].id.value],
      })
    );

    // 複製元（N9300001）の次番号が払い出される
    expect(result.estimateNumber.value).toBe("N9300002");
    expect(result.estimateType.value).toBe("NEW");

    // 選択順を保持し連番に振り直し、単価はクリア
    expect(result.variations).toHaveLength(2);
    expect(result.variations[0].variationNumber).toBe(1);
    expect(result.variations[0].items[0].itemName.value).toBe("商品B");
    expect(result.variations[0].items[0].unitPrice.isZero()).toBe(true);

    // 系譜が選択順で保存される
    const copyRows = await prisma.estimateVariationCopy.findMany({
      where: { copiedVariationId: { in: result.variations.map((v) => v.id.value) } },
    });
    expect(copyRows).toHaveLength(2);
    const sourceByCopied = new Map(copyRows.map((r) => [r.copiedVariationId, r.sourceVariationId]));
    expect(sourceByCopied.get(result.variations[0].id.value)).toBe(source.variations[1].id.value);
    expect(sourceByCopied.get(result.variations[1].id.value)).toBe(source.variations[0].id.value);

    // 複製元は変更されない
    const reloadedSource = await repository.findById(source.id);
    expect(reloadedSource?.variations).toHaveLength(2);
    expect(reloadedSource?.variations[0].items[0].unitPrice.majorUnits).toBe(1000);
  });

  it("複製元が存在しない場合は NotFoundEntityError", async () => {
    await expect(
      command.execute(
        baseInput(await repository.insert(buildSource()), {
          sourceEstimateId: EstimateId.generate().value,
        })
      )
    ).rejects.toBeInstanceOf(NotFoundEntityError);
  });

  it("選択なし（空選択）は BusinessRuleViolationError がドメインから bubble する", async () => {
    const source = await repository.insert(buildSource());

    await expect(
      command.execute(baseInput(source, { selectedVariationIds: [] }))
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });
});
