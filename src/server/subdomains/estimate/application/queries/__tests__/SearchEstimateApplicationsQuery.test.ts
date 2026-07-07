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
import { PrismaEstimateApplicationSearchQueryService } from "@subdomains/estimate/infrastructure/queries/PrismaEstimateApplicationSearchQueryService";
import { ApprovalChainPlan } from "@subdomains/estimate/domain/values/approval/ApprovalChainPlan";
import { EstimateExemptionReason } from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { RejectionComment } from "@subdomains/estimate/domain/values/approval/RejectionComment";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// 見積申請一覧 検索クエリのテスト帯（06x = N9907060-069）。レジストリが単一ソース（approvalTestBands）。
const EN = APPROVAL_TEST_BANDS.searchApplications;
const ALL_NUMBERS = Object.values(EN);
// 自分の band 全体を跨ぐ検索のスコープ（"N990706" は 060-069 のみに一致し他 band を含まない）。
const BAND_PREFIX = "N990706";

describe("PrismaEstimateApplicationSearchQueryService", () => {
  let service: PrismaEstimateApplicationSearchQueryService;
  let estimateRepository: PrismaEstimateRepository;
  let applicationRepository: PrismaEstimateApplicationRepository;
  let exemptionRepository: PrismaEstimateApprovalExemptionRepository;
  let ids: ApprovalFixtureIds;

  beforeAll(async () => {
    ids = await ensureApprovalFixtures();
  });

  beforeEach(async () => {
    service = new PrismaEstimateApplicationSearchQueryService();
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

  it("PENDING の申請を持つバリエーションが行として現れ、状態と表示列が組み立つ", async () => {
    const { variationIds } = await createEstimate(EN.pending);
    await submitApplication(variationIds[0]);

    const result = await service.search({ estimateNumber: EN.pending });

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.variationId).toBe(variationIds[0]);
    expect(row.estimateNumber).toBe(EN.pending);
    expect(row.variationNumber).toBe(1);
    expect(row.customerName).toBe("見積テスト得意先");
    expect(row.deliveryLocationName).toBe("見積テスト納品先");
    expect(row.applicationState.code).toBe("PENDING");
    expect(row.applicationState.label).toBe("申請中");
    expect(row.applicantName).toBe("申請者");
  });

  it("5値の状態がそれぞれ行として現れ、申請も免除も無いバリエーション（NONE）は除外される", async () => {
    // NONE: 申請も免除も無い（where で除外されるべき）。
    await createEstimate(EN.none);

    const pending = await createEstimate(EN.pending);
    await submitApplication(pending.variationIds[0]);

    const rejected = await createEstimate(EN.rejected);
    await rejectApplication(await submitApplication(rejected.variationIds[0]));

    const withdrawn = await createEstimate(EN.withdrawn);
    await withdrawApplication(await submitApplication(withdrawn.variationIds[0]));

    const approved = await createEstimate(EN.approved);
    await approveAllSteps(await submitApplication(approved.variationIds[0]));

    const exempted = await createEstimate(EN.exempted);
    await exemptVariation(exempted.variationIds[0]);

    // band 全体（N990706x）をスコープして検索する。
    const result = await service.search({ estimateNumber: BAND_PREFIX });

    // NONE は含まれず 5 行（PENDING/REJECTED/WITHDRAWN/APPROVED/EXEMPTED）。
    const codeByNumber = new Map(result.map((r) => [r.estimateNumber, r.applicationState.code]));
    expect(codeByNumber.has(EN.none)).toBe(false);
    expect(codeByNumber.get(EN.pending)).toBe("PENDING");
    expect(codeByNumber.get(EN.rejected)).toBe("REJECTED");
    expect(codeByNumber.get(EN.withdrawn)).toBe("WITHDRAWN");
    expect(codeByNumber.get(EN.approved)).toBe("APPROVED");
    expect(codeByNumber.get(EN.exempted)).toBe("EXEMPTED");
    expect(result).toHaveLength(5);
  });

  it("最新申請（attempt 最大）を状態の出自とし、過去 attempt にはヒットしない", async () => {
    const { variationIds } = await createEstimate(EN.multiAttempt);
    // attempt 1 を差戻し、attempt 2 を PENDING で再申請する。
    await rejectApplication(await submitApplication(variationIds[0], 1));
    await submitApplication(variationIds[0], 2);

    // 状態=承認済で絞れば当然出ないが、REJECTED（過去 attempt）で絞っても出ない。
    expect(await service.search({ estimateNumber: EN.multiAttempt, state: ["REJECTED"] })).toEqual(
      []
    );

    // 最新（attempt 2）の PENDING が出自。
    const result = await service.search({ estimateNumber: EN.multiAttempt });
    expect(result).toHaveLength(1);
    expect(result[0].applicationState.code).toBe("PENDING");

    // PENDING で絞ればヒットする。
    const pendingOnly = await service.search({
      estimateNumber: EN.multiAttempt,
      state: ["PENDING"],
    });
    expect(pendingOnly.map((r) => r.variationId)).toEqual([variationIds[0]]);
  });

  it("免除行の申請者・申請日時は免除者・免除日時を出自とし、承認待ち役割は null", async () => {
    const { variationIds } = await createEstimate(EN.exempted);
    await exemptVariation(variationIds[0]);
    const exemption = await prisma.estimateApprovalExemption.findUniqueOrThrow({
      where: { variationId: variationIds[0] },
      select: { createdAt: true },
    });

    const result = await service.search({ estimateNumber: EN.exempted });

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.applicationState.code).toBe("EXEMPTED");
    expect(row.applicationState.label).toBe("承認不要");
    // 「申請者」列は免除者、「申請日時」列は免除日時（同じ列が状態の出自を表す）。
    expect(row.applicantName).toBe("承認免除実施者");
    expect(row.appliedAt.getTime()).toBe(exemption.createdAt.getTime());
    // 免除に承認待ちは無い。
    expect(row.awaitingRoleName).toBeNull();
  });

  it("PENDING は先頭未承認ステップの役割を承認待ち役割として持ち、roleId で絞れる", async () => {
    const { variationIds } = await createEstimate(EN.awaiting);
    await submitApplication(variationIds[0]);
    // 承認待ちは先頭ステップ（stepRoleIds[0]）の役割。
    const firstStepRole = await prisma.role.findUniqueOrThrow({
      where: { id: ids.stepRoleIds[0] },
      select: { name: true },
    });

    const result = await service.search({ estimateNumber: EN.awaiting });
    expect(result[0].awaitingRoleName).toBe(firstStepRole.name);

    // 先頭ステップの roleId で絞ればヒットする。
    const byFirst = await service.search({
      estimateNumber: EN.awaiting,
      awaitingRoleId: ids.stepRoleIds[0],
    });
    expect(byFirst.map((r) => r.variationId)).toEqual([variationIds[0]]);

    // まだ承認待ちでない2段目（stepRoleIds[1]）の roleId では出ない。
    const bySecond = await service.search({
      estimateNumber: EN.awaiting,
      awaitingRoleId: ids.stepRoleIds[1],
    });
    expect(bySecond).toEqual([]);
  });

  it("非 PENDING（承認済）の承認待ち役割は null", async () => {
    const { variationIds } = await createEstimate(EN.approved);
    await approveAllSteps(await submitApplication(variationIds[0]));

    const result = await service.search({ estimateNumber: EN.approved });

    expect(result[0].applicationState.code).toBe("APPROVED");
    expect(result[0].awaitingRoleName).toBeNull();
  });

  it("既定は ACTIVE のみ、includeInactive=true で INACTIVE も対象化する", async () => {
    const { variationIds } = await createEstimate(EN.inactive);
    await submitApplication(variationIds[0]);
    // 読み取り状態のセットアップのためバリエーションを直接 INACTIVE にする。
    await prisma.estimateVariation.update({
      where: { id: variationIds[0] },
      data: { status: "INACTIVE" },
    });

    // 既定（有効のみ）では出ない。
    expect(await service.search({ estimateNumber: EN.inactive })).toEqual([]);

    // includeInactive=true で対象化される。
    const included = await service.search({ estimateNumber: EN.inactive, includeInactive: true });
    expect(included.map((r) => r.variationId)).toEqual([variationIds[0]]);
  });

  it("不変事実（得意先名・納品先名）の部分一致で候補を絞る", async () => {
    const { variationIds } = await createEstimate(EN.invariant);
    await submitApplication(variationIds[0]);

    // 得意先名の部分一致でヒットする。
    expect(
      (await service.search({ estimateNumber: EN.invariant, customerName: "得意先" })).map(
        (r) => r.variationId
      )
    ).toEqual([variationIds[0]]);
    // 納品先名の部分一致でヒットする。
    expect(
      (await service.search({ estimateNumber: EN.invariant, deliveryLocationName: "納品先" })).map(
        (r) => r.variationId
      )
    ).toEqual([variationIds[0]]);
    // 一致しない得意先名では空。
    expect(
      await service.search({ estimateNumber: EN.invariant, customerName: "存在しない得意先" })
    ).toEqual([]);
  });
});
