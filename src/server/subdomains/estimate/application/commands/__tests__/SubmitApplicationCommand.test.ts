import {
  cleanupApprovalFixtures,
  ensureApprovalFixtures,
  type ApprovalFixtureIds,
} from "@server/__tests__/helpers/ensureApprovalFixtures";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { PrismaPositionQueryService } from "@subdomains/position/infrastructure/queries/PrismaPositionQueryService";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import {
  buildNewEstimate,
  makeItem,
} from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { PrismaEstimateApplicationRepository } from "@subdomains/estimate/infrastructure/prisma/approval/PrismaEstimateApplicationRepository";
import { PrismaEstimateApprovalExemptionRepository } from "@subdomains/estimate/infrastructure/prisma/approval/PrismaEstimateApprovalExemptionRepository";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SubmitApplicationCommand } from "../SubmitApplicationCommand";

/**
 * 見積申請コマンドの統合テスト（#417・ADR-0066・実 Prisma・モック禁止）。
 * シードの正準組織を再利用し、申請操作者の上位役割を営業一課長(ROLE009)に設定する。
 */
describe("SubmitApplicationCommand", () => {
  const EN = {
    required: "N9909001",
    exempt: "N9909002",
    blocked: "N9909003",
    inactive: "N9909004",
    sibling: "N9909005",
    stale: "N9909006",
  } as const;
  const ALL_NUMBERS = Object.values(EN);
  const OPERATOR_CD = "EMP999097";
  /** 高額（部長ゴール）にする明細単価。 */
  const REQUIRED_UNIT_PRICE = 1_000_000;
  /** insert 直後の Estimate.version（@default(1)）。version はドメインに持たせず repo 引数で渡す（ADR-0039）。 */
  const INITIAL_VERSION = 1;

  let command: SubmitApplicationCommand;
  let estimateRepository: PrismaEstimateRepository;
  let applicationRepository: PrismaEstimateApplicationRepository;
  let exemptionRepository: PrismaEstimateApprovalExemptionRepository;
  let ids: ApprovalFixtureIds;
  let operatorId: string;

  const requiredItems = () => [
    makeItem(ids.estimate.productId, { sortOrder: 1, unitPrice: REQUIRED_UNIT_PRICE, quantity: 1 }),
  ];

  beforeAll(async () => {
    ids = await ensureApprovalFixtures();
    const operator = await prisma.employee.upsert({
      where: { employeeCd: OPERATOR_CD },
      update: { superiorRoleId: ids.stepRoleIds[0] },
      create: {
        id: generateId(),
        employeeCd: OPERATOR_CD,
        email: "submit-operator@example.com",
        name: "申請操作者",
        departmentId: ids.estimate.departmentId,
        superiorRoleId: ids.stepRoleIds[0],
      },
    });
    operatorId = operator.id;
  });

  beforeEach(async () => {
    estimateRepository = new PrismaEstimateRepository();
    applicationRepository = new PrismaEstimateApplicationRepository();
    exemptionRepository = new PrismaEstimateApprovalExemptionRepository();
    command = new SubmitApplicationCommand(
      estimateRepository,
      applicationRepository,
      exemptionRepository,
      new PrismaProductQueryService(),
      new PrismaEmployeeQueryService(),
      new PrismaPositionQueryService(),
      new PrismaRoleQueryService()
    );
    await cleanupApprovalFixtures(ALL_NUMBERS);
  });

  afterAll(async () => {
    await cleanupApprovalFixtures(ALL_NUMBERS);
    await prisma.employee.deleteMany({ where: { employeeCd: OPERATOR_CD } });
  });

  it("承認必要なら申請＋ステップ列を永続化する（attempt=1・連番・finalApprovalPositionId）", async () => {
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, EN.required, { items: requiredItems() })
    );
    const variationId = estimate.variations[0].id.value;

    const result = await command.execute({
      estimateId: estimate.id.value,
      variationId,
      operatorEmployeeId: operatorId,
      version: INITIAL_VERSION,
    });

    expect(result.kind).toBe("ApplicationSubmitted");
    if (result.kind !== "ApplicationSubmitted") throw new Error("expected ApplicationSubmitted");
    expect(result.attempt).toBe(1);
    expect(result.finalApprovalPositionId).toBe(ids.goalPositionId);

    const persisted = await applicationRepository.findByVariationId(
      new EstimateVariationId(variationId)
    );
    expect(persisted).toHaveLength(1);
    expect(persisted[0].attempt).toBe(1);
    expect(persisted[0].steps.map((s) => s.stepOrder)).toEqual([1, 2]);
  });

  it("免除なら免除を1件記録し、申請行は作らない", async () => {
    const estimate = await estimateRepository.insert(buildNewEstimate(ids.estimate, EN.exempt));
    const variationId = estimate.variations[0].id.value;

    const result = await command.execute({
      estimateId: estimate.id.value,
      variationId,
      operatorEmployeeId: operatorId,
      version: INITIAL_VERSION,
    });

    expect(result.kind).toBe("ApprovalExempted");
    if (result.kind !== "ApprovalExempted") throw new Error("expected ApprovalExempted");
    expect(result.reason).toBe("BELOW_THRESHOLD");

    const exemption = await exemptionRepository.findByVariationId(
      new EstimateVariationId(variationId)
    );
    expect(exemption).not.toBeNull();
    const applications = await applicationRepository.findByVariationId(
      new EstimateVariationId(variationId)
    );
    expect(applications).toHaveLength(0);
  });

  it("申請不可（上位役割未設定）なら BusinessRuleViolationError を投げ、何も永続化しない", async () => {
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, EN.blocked, { items: requiredItems() })
    );
    const variationId = estimate.variations[0].id.value;

    await expect(
      command.execute({
        estimateId: estimate.id.value,
        variationId,
        // 上位役割を持たない見積作成者を操作者にして BLOCKED(NO_SUPERIOR_ROLE) を誘発する。
        operatorEmployeeId: ids.estimate.employeeId,
        version: INITIAL_VERSION,
      })
    ).rejects.toThrow(BusinessRuleViolationError);

    const applications = await applicationRepository.findByVariationId(
      new EstimateVariationId(variationId)
    );
    expect(applications).toHaveLength(0);
    // BLOCKED は version 関門の前段で弾くため version は据え置き（空振り bump なし）。
    const after = await prisma.estimate.findUnique({
      where: { id: estimate.id.value },
      select: { version: true },
    });
    expect(after?.version).toBe(INITIAL_VERSION);
  });

  it("INACTIVE バリエーションには申請できない", async () => {
    // 複数バリエーションでは items 上書きを使わない（同一 item インスタンス共有による id 衝突を避ける）。
    // INACTIVE 判定は judge 前に弾くため金額は不問。
    const built = buildNewEstimate(ids.estimate, EN.inactive, {
      variationNumbers: [1, 2],
    });
    const targetVariationId = built.variations[1].id;
    built.deactivateVariation(targetVariationId);
    const estimate = await estimateRepository.insert(built);

    await expect(
      command.execute({
        estimateId: estimate.id.value,
        variationId: targetVariationId.value,
        operatorEmployeeId: operatorId,
        version: INITIAL_VERSION,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("兄弟が前進中なら拒否する（1見積1前進）", async () => {
    // 既定の低額見積（複数バリエーション）。v0 は免除＝前進になり、v1 申請が兄弟前進で弾かれる。
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, EN.sibling, { variationNumbers: [1, 2] })
    );

    // 先に variation[0] を申請して前進させる（既定低額のため免除＝前進）。
    await command.execute({
      estimateId: estimate.id.value,
      variationId: estimate.variations[0].id.value,
      operatorEmployeeId: operatorId,
      version: INITIAL_VERSION,
    });

    // variation[1] への申請は兄弟前進により拒否される。
    await expect(
      command.execute({
        estimateId: estimate.id.value,
        variationId: estimate.variations[1].id.value,
        operatorEmployeeId: operatorId,
        version: INITIAL_VERSION,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("取得後に version がずれていたら ConflictError（version 関門）で申請行は作らない", async () => {
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, EN.stale, { items: requiredItems() })
    );
    const variationId = estimate.variations[0].id.value;

    await expect(
      command.execute({
        estimateId: estimate.id.value,
        variationId,
        operatorEmployeeId: operatorId,
        // Preview 後に他者が更新したことを模す stale な version。
        version: INITIAL_VERSION + 99,
      })
    ).rejects.toThrow(ConflictError);

    const applications = await applicationRepository.findByVariationId(
      new EstimateVariationId(variationId)
    );
    expect(applications).toHaveLength(0);
  });
});
