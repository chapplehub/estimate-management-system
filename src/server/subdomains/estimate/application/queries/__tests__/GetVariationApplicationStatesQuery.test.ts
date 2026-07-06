import { APPROVAL_TEST_BANDS } from "@server/__tests__/helpers/approvalTestBands";
import {
  cleanupApprovalFixtures,
  ensureApprovalFixtures,
  type ApprovalFixtureIds,
} from "@server/__tests__/helpers/ensureApprovalFixtures";
import prisma from "@server/prisma";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import {
  EstimateApplication,
  EstimateApprovalExemption,
} from "@subdomains/estimate/domain/entities";
import { buildNewEstimate } from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import { PrismaEstimateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaEstimateRepository";
import { PrismaEstimateApplicationRepository } from "@subdomains/estimate/infrastructure/prisma/approval/PrismaEstimateApplicationRepository";
import { PrismaEstimateApprovalExemptionRepository } from "@subdomains/estimate/infrastructure/prisma/approval/PrismaEstimateApprovalExemptionRepository";
import { PrismaVariationApplicationStateQueryService } from "@subdomains/estimate/infrastructure/queries/PrismaVariationApplicationStateQueryService";
import { ApprovalChainPlan } from "@subdomains/estimate/domain/values/approval/ApprovalChainPlan";
import { EstimateExemptionReason } from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { RejectionComment } from "@subdomains/estimate/domain/values/approval/RejectionComment";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { GetVariationApplicationStatesQuery } from "../GetVariationApplicationStatesQuery";

// 承認系 query テスト帯（05x = N9907050-058）。レジストリが単一ソース（#493・approvalTestBands）。
const EN = APPROVAL_TEST_BANDS.variationQuery;
const ALL_NUMBERS = Object.values(EN);

describe("GetVariationApplicationStatesQuery", () => {
  let query: GetVariationApplicationStatesQuery;
  let estimateRepository: PrismaEstimateRepository;
  let applicationRepository: PrismaEstimateApplicationRepository;
  let exemptionRepository: PrismaEstimateApprovalExemptionRepository;
  let ids: ApprovalFixtureIds;

  beforeAll(async () => {
    ids = await ensureApprovalFixtures();
  });

  beforeEach(async () => {
    query = new GetVariationApplicationStatesQuery(
      new PrismaVariationApplicationStateQueryService()
    );
    estimateRepository = new PrismaEstimateRepository();
    applicationRepository = new PrismaEstimateApplicationRepository();
    exemptionRepository = new PrismaEstimateApprovalExemptionRepository();
    await cleanupApprovalFixtures(ALL_NUMBERS);
  });

  afterAll(async () => {
    await cleanupApprovalFixtures(ALL_NUMBERS);
  });

  /** 実 estimate を insert し、estimateId と variationNumber 昇順のバリエーション ID 群を返す。 */
  async function createEstimate(
    estimateNumber: string,
    variationNumbers: number[] = [1]
  ): Promise<{ estimateId: string; variationIds: string[] }> {
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, estimateNumber, { variationNumbers })
    );
    const variationIds = [...estimate.variations]
      .sort((a, b) => a.variationNumber - b.variationNumber)
      .map((v) => v.id.value);
    return { estimateId: estimate.id.value, variationIds };
  }

  function buildPlan(): ApprovalChainPlan {
    return ApprovalChainPlan.create(
      new PositionId(ids.goalPositionId),
      ids.stepRoleIds.map((id) => new RoleId(id))
    );
  }

  /** PENDING な申請を1件永続化する。 */
  async function submitApplication(variationId: string): Promise<EstimateApplication> {
    return applicationRepository.insert(
      EstimateApplication.create({
        variationId: new EstimateVariationId(variationId),
        attempt: 1,
        applicantEmployeeId: new EmployeeId(ids.applicantEmployeeId),
        plan: buildPlan(),
      })
    );
  }

  it("申請も免除も無いバリエーションは NONE（未申請）・ACTIVE 単独なら canApply", async () => {
    const { estimateId } = await createEstimate(EN.none);

    const result = await query.execute({ estimateId });

    expect(result).toHaveLength(1);
    expect(result[0].applicationState.code).toBe("NONE");
    expect(result[0].applicationState.label).toBe("未申請");
    expect(result[0].canApply).toBe(true);
  });

  it("PENDING の申請は前進バリなので canApply=false（申請中バッジ）", async () => {
    const { estimateId, variationIds } = await createEstimate(EN.pending);
    await submitApplication(variationIds[0]);

    const result = await query.execute({ estimateId });

    expect(result[0].variationId).toBe(variationIds[0]);
    expect(result[0].applicationState.code).toBe("PENDING");
    expect(result[0].applicationState.label).toBe("申請中");
    expect(result[0].canApply).toBe(false);
  });

  it("差戻（REJECTED）は非前進なので再申請可能（canApply=true）", async () => {
    const { estimateId, variationIds } = await createEstimate(EN.rejected);
    const app = await submitApplication(variationIds[0]);
    app.reject(
      app.steps[0].id,
      new EmployeeId(ids.approverEmployeeId),
      new RejectionComment("金額の根拠が不足しています")
    );
    await applicationRepository.update(app, 1);

    const result = await query.execute({ estimateId });

    expect(result[0].applicationState.code).toBe("REJECTED");
    expect(result[0].applicationState.label).toBe("差戻");
    expect(result[0].canApply).toBe(true);
  });

  it("取下（WITHDRAWN）は非前進なので再申請可能（canApply=true）", async () => {
    const { estimateId, variationIds } = await createEstimate(EN.withdrawn);
    const app = await submitApplication(variationIds[0]);
    app.withdraw(new EmployeeId(ids.applicantEmployeeId));
    await applicationRepository.update(app, 1);

    const result = await query.execute({ estimateId });

    expect(result[0].applicationState.code).toBe("WITHDRAWN");
    expect(result[0].applicationState.label).toBe("取下");
    expect(result[0].canApply).toBe(true);
  });

  it("全ステップ承認（APPROVED）は前進バリなので canApply=false", async () => {
    const { estimateId, variationIds } = await createEstimate(EN.approved);
    const app = await submitApplication(variationIds[0]);
    const approver = new EmployeeId(ids.approverEmployeeId);
    app.approve(app.steps[0].id, approver);
    const afterStep1 = await applicationRepository.update(app, 1);
    afterStep1.approve(afterStep1.steps[1].id, approver);
    await applicationRepository.update(afterStep1, 2);

    const result = await query.execute({ estimateId });

    expect(result[0].applicationState.code).toBe("APPROVED");
    expect(result[0].applicationState.label).toBe("承認済");
    expect(result[0].canApply).toBe(false);
  });

  it("承認免除（EXEMPTED）は前進バリ・ラベルは「承認不要」・canApply=false", async () => {
    const { estimateId, variationIds } = await createEstimate(EN.exempted);
    await exemptionRepository.insert(
      EstimateApprovalExemption.create(
        new EstimateVariationId(variationIds[0]),
        EstimateExemptionReason.BELOW_THRESHOLD,
        new EmployeeId(ids.exempterEmployeeId)
      )
    );

    const result = await query.execute({ estimateId });

    expect(result[0].applicationState.code).toBe("EXEMPTED");
    expect(result[0].applicationState.label).toBe("承認不要");
    expect(result[0].canApply).toBe(false);
  });

  it("兄弟の1つが前進中なら見積内の全 ACTIVE バリの canApply=false（1見積1前進）・variationNumber 昇順", async () => {
    const { estimateId, variationIds } = await createEstimate(EN.siblings, [1, 2]);
    await submitApplication(variationIds[0]); // バリ1を PENDING（前進）にする

    const result = await query.execute({ estimateId });

    expect(result.map((r) => r.variationId)).toEqual(variationIds); // 昇順
    expect(result[0].applicationState.code).toBe("PENDING");
    expect(result[0].canApply).toBe(false);
    // 兄弟（バリ2）は未申請・ACTIVE だが、見積内に前進バリがあるため申請不可。
    expect(result[1].applicationState.code).toBe("NONE");
    expect(result[1].canApply).toBe(false);
  });

  it("INACTIVE バリは canApply=false、かつ他の兄弟をブロックしない", async () => {
    const { estimateId, variationIds } = await createEstimate(EN.inactive, [1, 2]);
    // バリ1を INACTIVE にする（読み取り状態のセットアップのため直接更新）。
    await prisma.estimateVariation.update({
      where: { id: variationIds[0] },
      data: { status: "INACTIVE" },
    });

    const result = await query.execute({ estimateId });

    expect(result[0].variationId).toBe(variationIds[0]);
    expect(result[0].canApply).toBe(false); // INACTIVE
    // バリ2は ACTIVE・前進バリ無し（INACTIVE はブロックしない）→ 申請可能。
    expect(result[1].canApply).toBe(true);
  });

  it("存在しない見積 ID は空配列", async () => {
    const result = await query.execute({ estimateId: "00000000-0000-0000-0000-000000000000" });
    expect(result).toEqual([]);
  });
});
