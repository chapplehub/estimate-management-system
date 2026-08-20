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
import { ApprovalChainPlan } from "@subdomains/estimate/domain/values/approval/ApprovalChainPlan";
import { EstimateExemptionReason } from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { RejectionComment } from "@subdomains/estimate/domain/values/approval/RejectionComment";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaEstimateApplicationDetailQueryService } from "../PrismaEstimateApplicationDetailQueryService";

// 見積申請詳細 参照クエリのテスト帯（07x = N9907070-079）。レジストリが単一ソース（approvalTestBands）。
const EN = APPROVAL_TEST_BANDS.applicationDetail;
const ALL_NUMBERS = Object.values(EN);

describe("PrismaEstimateApplicationDetailQueryService", () => {
  let service: PrismaEstimateApplicationDetailQueryService;
  let estimateRepository: PrismaEstimateRepository;
  let applicationRepository: PrismaEstimateApplicationRepository;
  let exemptionRepository: PrismaEstimateApprovalExemptionRepository;
  let ids: ApprovalFixtureIds;

  beforeAll(async () => {
    ids = await ensureApprovalFixtures();
  });

  beforeEach(async () => {
    service = new PrismaEstimateApplicationDetailQueryService();
    estimateRepository = new PrismaEstimateRepository();
    applicationRepository = new PrismaEstimateApplicationRepository();
    exemptionRepository = new PrismaEstimateApprovalExemptionRepository();
    await cleanupApprovalFixtures(ALL_NUMBERS);
  });

  afterAll(async () => {
    await cleanupApprovalFixtures(ALL_NUMBERS);
  });

  /** 実 estimate を insert し、variationNumber 昇順のバリエーション ID 群を返す。 */
  async function createEstimate(estimateNumber: string): Promise<{ variationIds: string[] }> {
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, estimateNumber)
    );
    const variationIds = [...estimate.variations]
      .sort((a, b) => a.variationNumber - b.variationNumber)
      .map((v) => v.id.value);
    return { variationIds };
  }

  function buildPlan(): ApprovalChainPlan {
    return ApprovalChainPlan.create(
      new PositionId(ids.goalPositionId),
      ids.stepRoleIds.map((id) => new RoleId(id))
    );
  }

  /** PENDING な申請を1件永続化する（attempt 指定可）。 */
  async function submitApplication(variationId: string, attempt = 1): Promise<EstimateApplication> {
    return applicationRepository.insert(
      EstimateApplication.create({
        variationId: new EstimateVariationId(variationId),
        attempt,
        applicantEmployeeId: new EmployeeId(ids.applicantEmployeeId),
        plan: buildPlan(),
      })
    );
  }

  /** 申請を差戻す（先頭ステップを差戻・REJECTED になる）。 */
  async function rejectApplication(app: EstimateApplication): Promise<void> {
    app.reject(
      app.steps[0].id,
      new EmployeeId(ids.approverEmployeeId),
      new RejectionComment("金額の根拠が不足しています")
    );
    await applicationRepository.update(app, 1);
  }

  /** 申請を取下げる（申請者本人・WITHDRAWN になる）。 */
  async function withdrawApplication(app: EstimateApplication): Promise<void> {
    app.withdraw(new EmployeeId(ids.applicantEmployeeId));
    await applicationRepository.update(app, 1);
  }

  /** 全ステップを承認する（APPROVED になる）。 */
  async function approveAllSteps(app: EstimateApplication): Promise<void> {
    const approver = new EmployeeId(ids.approverEmployeeId);
    app.approve(app.steps[0].id, approver);
    const afterStep1 = await applicationRepository.update(app, 1);
    afterStep1.approve(afterStep1.steps[1].id, approver);
    await applicationRepository.update(afterStep1, 2);
  }

  /** バリエーションを承認免除にする（EXEMPTED になる）。 */
  async function exemptVariation(variationId: string): Promise<void> {
    await exemptionRepository.insert(
      EstimateApprovalExemption.create(
        new EstimateVariationId(variationId),
        EstimateExemptionReason.BELOW_THRESHOLD,
        new EmployeeId(ids.exempterEmployeeId)
      )
    );
  }

  it("申請中1回目: APPLICATIONS 枝・latest が PENDING・先頭ステップが AWAITING・宛先IDが載る", async () => {
    const { variationIds } = await createEstimate(EN.pending);
    const app = await submitApplication(variationIds[0]);

    const result = await service.findDetail(EN.pending, 1);

    expect(result).not.toBeNull();
    if (result === null || result.kind !== "APPLICATIONS") throw new Error("APPLICATIONS 枝のはず");

    // summary
    expect(result.summary.estimateNumber).toBe(EN.pending);
    expect(result.summary.variationNumber).toBe(1);
    expect(result.summary.customerName).toBe("見積テスト得意先");
    expect(result.summary.applicationState.code).toBe("PENDING");
    expect(result.summary.applicationState.label).toBe("申請中");

    // latest / past
    expect(result.past).toEqual([]);
    expect(result.latest.attempt).toBe(1);
    expect(result.latest.applicantName).toBe("申請者");
    expect(result.latest.status.code).toBe("PENDING");
    expect(result.latest.withdrawal).toBeNull();

    // steps（stepOrder 昇順・先頭 AWAITING・2段目 NOT_STARTED）
    expect(result.latest.steps.map((s) => s.order)).toEqual([1, 2]);
    expect(result.latest.steps[0].status.code).toBe("AWAITING");
    expect(result.latest.steps[1].status.code).toBe("NOT_STARTED");
    expect(result.latest.steps[0].actorName).toBeNull();

    // operationFacts（宛先ID群・操作者非依存）
    expect(result.operationFacts.isPending).toBe(true);
    expect(result.operationFacts.applicantEmployeeId).toBe(ids.applicantEmployeeId);
    expect(result.operationFacts.awaitingRoleId).toBe(ids.stepRoleIds[0]);
    expect(result.operationFacts.latestApplicationId).toBe(app.id.value);
    expect(result.operationFacts.awaitingStepId).toBe(app.steps[0].id.value);
    expect(result.operationFacts.expectedVersion).toBe(1);
  });

  it("差戻→再申請: latest は attempt2 の PENDING、past は attempt1 の REJECTED（差戻コメント付き）", async () => {
    const { variationIds } = await createEstimate(EN.rejectedResubmit);
    await rejectApplication(await submitApplication(variationIds[0], 1));
    await submitApplication(variationIds[0], 2);

    const result = await service.findDetail(EN.rejectedResubmit, 1);

    expect(result).not.toBeNull();
    if (result === null || result.kind !== "APPLICATIONS") throw new Error("APPLICATIONS 枝のはず");

    // summary は最新 attempt（PENDING）を出自とする。
    expect(result.summary.applicationState.code).toBe("PENDING");

    // latest = attempt2（PENDING）。
    expect(result.latest.attempt).toBe(2);
    expect(result.latest.status.code).toBe("PENDING");

    // past = attempt1（REJECTED）。先頭ステップが差戻・コメントと差戻者を畳み込む。
    expect(result.past).toHaveLength(1);
    const rejected = result.past[0];
    expect(rejected.attempt).toBe(1);
    expect(rejected.status.code).toBe("REJECTED");
    expect(rejected.steps[0].status.code).toBe("REJECTED");
    expect(rejected.steps[0].actorName).toBe("承認者");
    expect(rejected.steps[0].rejectionComment).toBe("金額の根拠が不足しています");
    // 承認済でも未決でもないステップの rejectionComment は null。
    expect(result.latest.steps[0].rejectionComment).toBeNull();
  });

  it("承認済: latest が APPROVED・全ステップ APPROVED・operationFacts は非 PENDING（全 null/false）", async () => {
    const { variationIds } = await createEstimate(EN.approved);
    await approveAllSteps(await submitApplication(variationIds[0]));

    const result = await service.findDetail(EN.approved, 1);

    expect(result).not.toBeNull();
    if (result === null || result.kind !== "APPLICATIONS") throw new Error("APPLICATIONS 枝のはず");

    expect(result.summary.applicationState.code).toBe("APPROVED");
    expect(result.latest.status.code).toBe("APPROVED");
    expect(result.latest.steps.map((s) => s.status.code)).toEqual(["APPROVED", "APPROVED"]);
    expect(result.latest.steps[0].actorName).toBe("承認者");

    // 非 PENDING なので操作可否の材料・宛先は無い。
    expect(result.operationFacts.isPending).toBe(false);
    expect(result.operationFacts.awaitingStepId).toBeNull();
    expect(result.operationFacts.latestApplicationId).toBeNull();
    expect(result.operationFacts.expectedVersion).toBeNull();
  });

  it("取下: latest が WITHDRAWN・取下記録（取下者・日時）が載る", async () => {
    const { variationIds } = await createEstimate(EN.withdrawn);
    await withdrawApplication(await submitApplication(variationIds[0]));

    const result = await service.findDetail(EN.withdrawn, 1);

    expect(result).not.toBeNull();
    if (result === null || result.kind !== "APPLICATIONS") throw new Error("APPLICATIONS 枝のはず");

    expect(result.summary.applicationState.code).toBe("WITHDRAWN");
    expect(result.latest.status.code).toBe("WITHDRAWN");
    expect(result.latest.withdrawal).not.toBeNull();
    expect(result.latest.withdrawal?.withdrawnByName).toBe("申請者");
    expect(result.operationFacts.isPending).toBe(false);
  });

  it("免除のみ: EXEMPTED 枝・免除記録（理由code+label・免除者・日時）が載り operationFacts は全 null/false", async () => {
    const { variationIds } = await createEstimate(EN.exempted);
    await exemptVariation(variationIds[0]);
    const exemption = await prisma.estimateApprovalExemption.findUniqueOrThrow({
      where: { variationId: variationIds[0] },
      select: { createdAt: true },
    });

    const result = await service.findDetail(EN.exempted, 1);

    expect(result).not.toBeNull();
    if (result === null || result.kind !== "EXEMPTED") throw new Error("EXEMPTED 枝のはず");

    expect(result.summary.applicationState.code).toBe("EXEMPTED");
    expect(result.summary.applicationState.label).toBe("承認不要");
    expect(result.exemption.reason.code).toBe("BELOW_THRESHOLD");
    expect(result.exemption.reason.label).toBe("10万円未満");
    expect(result.exemption.exemptedByName).toBe("承認免除実施者");
    expect(result.exemption.exemptedAt.getTime()).toBe(exemption.createdAt.getTime());
    expect(result.operationFacts.isPending).toBe(false);
    expect(result.operationFacts.expectedVersion).toBeNull();
  });

  it("NotFound: 存在しない見積番号・申請も免除も無いバリエーションは null", async () => {
    // 見積番号なし。
    expect(await service.findDetail("NOPE-9999", 1)).toBeNull();

    // 見積は在るがバリエーション番号なし。
    await createEstimate(EN.missing);
    expect(await service.findDetail(EN.missing, 99)).toBeNull();

    // バリエーションは在るが申請も免除も無い（NONE）→ 一覧の母集合と整合で null。
    expect(await service.findDetail(EN.missing, 1)).toBeNull();
  });
});
