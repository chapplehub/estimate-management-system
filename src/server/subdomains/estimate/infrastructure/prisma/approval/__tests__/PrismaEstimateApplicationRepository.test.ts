import {
  cleanupApprovalFixtures,
  ensureApprovalFixtures,
  type ApprovalFixtureIds,
} from "@server/__tests__/helpers/ensureApprovalFixtures";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { PrismaTransactionRunner } from "@server/shared/infrastructure/transaction/PrismaTransactionRunner";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { EstimateApplication } from "@subdomains/estimate/domain/entities";
import { buildNewEstimate } from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import { ApprovalChainPlan } from "@subdomains/estimate/domain/values/approval/ApprovalChainPlan";
import { OccurredAt } from "@subdomains/estimate/domain/values/approval/OccurredAt";
import { RejectionComment } from "@subdomains/estimate/domain/values/approval/RejectionComment";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaEstimateRepository } from "../../PrismaEstimateRepository";
import { PrismaEstimateApplicationRepository } from "../PrismaEstimateApplicationRepository";

// 承認系テスト見積番号（N9907xxx 帯。免除テストの 001/002 と分けて 01x を使う）。
const EN = {
  roundtrip: "N9907010",
  byStep: "N9907011",
  history: "N9907012",
  conflict: "N9907013",
  approve: "N9907014",
  reject: "N9907015",
  withdraw: "N9907016",
  stale: "N9907017",
  txRollback: "N9907018",
} as const;
const ALL_NUMBERS = Object.values(EN);

describe("PrismaEstimateApplicationRepository", () => {
  let repository: PrismaEstimateApplicationRepository;
  let estimateRepository: PrismaEstimateRepository;
  let ids: ApprovalFixtureIds;

  beforeAll(async () => {
    ids = await ensureApprovalFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateApplicationRepository();
    estimateRepository = new PrismaEstimateRepository();
    await cleanupApprovalFixtures(ALL_NUMBERS);
  });

  afterAll(async () => {
    await cleanupApprovalFixtures(ALL_NUMBERS);
  });

  /** 実 estimate を insert して本物の FK を持つバリエーション ID を得る。 */
  async function createVariationId(estimateNumber: string): Promise<EstimateVariationId> {
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, estimateNumber)
    );
    return estimate.variations[0].id;
  }

  /** 部長ゴール・2段（営業一課長 → 営業部長）の手組みチェーン計画。 */
  function buildPlan(): ApprovalChainPlan {
    return ApprovalChainPlan.create(
      new PositionId(ids.goalPositionId),
      ids.stepRoleIds.map((id) => new RoleId(id))
    );
  }

  /** PENDING な新規申請を組み立てる。 */
  function buildApplication(variationId: EstimateVariationId, attempt = 1): EstimateApplication {
    return EstimateApplication.create({
      variationId,
      attempt,
      applicantEmployeeId: new EmployeeId(ids.applicantEmployeeId),
      plan: buildPlan(),
    });
  }

  it("insert → findById で PENDING 状態の導出が往復を生き残る", async () => {
    const variationId = await createVariationId(EN.roundtrip);
    const application = buildApplication(variationId);

    const saved = await repository.insert(application);
    const found = await repository.findById(saved.id);

    expect(found).not.toBeNull();
    if (!found) return;
    expect(found.id.value).toBe(saved.id.value);
    expect(found.variationId.value).toBe(variationId.value);
    expect(found.attempt).toBe(1);
    expect(found.applicantEmployeeId.value).toBe(ids.applicantEmployeeId);
    expect(found.finalApprovalPositionId.value).toBe(ids.goalPositionId);

    // 状態は保存せず行の存在から導出する（ADR-0058）。生成直後は申請 PENDING。
    expect(found.applicationStatus.value).toBe("PENDING");

    // ステップ骨格（順序・役割）が往復で保たれる。
    expect(found.steps).toHaveLength(2);
    expect(found.steps[0].stepOrder).toBe(1);
    expect(found.steps[0].roleId.value).toBe(ids.stepRoleIds[0]);
    expect(found.steps[1].stepOrder).toBe(2);
    expect(found.steps[1].roleId.value).toBe(ids.stepRoleIds[1]);

    // 先頭ステップが AWAITING、以降は NOT_STARTED（§3.6 導出）。
    expect(found.stepStatus(found.steps[0].id).value).toBe("AWAITING");
    expect(found.stepStatus(found.steps[1].id).value).toBe("NOT_STARTED");
  });

  it("findByStepId で当該ステップを含む申請ルートを取得できる", async () => {
    const variationId = await createVariationId(EN.byStep);
    const saved = await repository.insert(buildApplication(variationId));
    const targetStepId = saved.steps[1].id;

    const found = await repository.findByStepId(targetStepId);

    expect(found).not.toBeNull();
    if (!found) return;
    expect(found.id.value).toBe(saved.id.value);
    expect(found.steps.some((s) => s.id.value === targetStepId.value)).toBe(true);
  });

  it("findByVariationId は attempt 複数件の履歴を返す", async () => {
    const variationId = await createVariationId(EN.history);
    await repository.insert(buildApplication(variationId, 1));
    await repository.insert(buildApplication(variationId, 2));

    const found = await repository.findByVariationId(variationId);

    expect(found).toHaveLength(2);
    expect(found.map((a) => a.attempt).sort()).toEqual([1, 2]);
  });

  it("(variationId, attempt) の二重 insert は ConflictError", async () => {
    const variationId = await createVariationId(EN.conflict);
    await repository.insert(buildApplication(variationId, 1));

    await expect(repository.insert(buildApplication(variationId, 1))).rejects.toBeInstanceOf(
      ConflictError
    );
  });

  it("ambient トランザクション内で insert 後に後続処理が失敗すると申請行がロールバックされる（atomic submit 基盤・ADR-20260626-dee）", async () => {
    const txRunner = new PrismaTransactionRunner();
    const variationId = await createVariationId(EN.txRollback);

    // insert が素 prisma ではなく currentClient() 経由で ambient tx に相乗りしていれば、
    // 後続の throw で申請行ごとロールバックされる（atomic submit の挿入側原子性）。
    await expect(
      txRunner.run(async () => {
        await repository.insert(buildApplication(variationId));
        throw new Error("simulate downstream failure");
      })
    ).rejects.toThrow("simulate downstream failure");

    const found = await repository.findByVariationId(variationId);
    expect(found).toHaveLength(0);
  });

  describe("update（承認・差戻・取下＋楽観ロック）", () => {
    it("approve 連鎖で順次 APPROVED になり、最終承認で申請 APPROVED（往復生存）", async () => {
      const variationId = await createVariationId(EN.approve);
      const saved = await repository.insert(buildApplication(variationId));
      const approver = new EmployeeId(ids.approverEmployeeId);

      // step1 承認 → version 1 で更新（成功後 DB version は 2）
      saved.approve(saved.steps[0].id, approver);
      const afterStep1 = await repository.update(saved, 1);

      expect(afterStep1.applicationStatus.value).toBe("PENDING");
      expect(afterStep1.stepStatus(afterStep1.steps[0].id).value).toBe("APPROVED");
      expect(afterStep1.stepStatus(afterStep1.steps[1].id).value).toBe("AWAITING");
      // occurredAt は DB の created_at で確定し、refetch 後に復元される（ADR-0058）
      expect(afterStep1.steps[0].approval).not.toBeNull();
      expect(afterStep1.steps[0].approval?.occurredAt).toBeInstanceOf(OccurredAt);

      // step2 承認（最終）→ version 2 で更新
      afterStep1.approve(afterStep1.steps[1].id, approver);
      const afterStep2 = await repository.update(afterStep1, 2);

      expect(afterStep2.applicationStatus.value).toBe("APPROVED");
      expect(afterStep2.stepStatus(afterStep2.steps[1].id).value).toBe("APPROVED");
    });

    it("reject で申請 REJECTED（往復生存）", async () => {
      const variationId = await createVariationId(EN.reject);
      const saved = await repository.insert(buildApplication(variationId));

      saved.reject(
        saved.steps[0].id,
        new EmployeeId(ids.approverEmployeeId),
        new RejectionComment("金額の根拠が不足しています")
      );
      const updated = await repository.update(saved, 1);

      expect(updated.applicationStatus.value).toBe("REJECTED");
      expect(updated.stepStatus(updated.steps[0].id).value).toBe("REJECTED");
      expect(updated.steps[0].rejection?.comment.value).toBe("金額の根拠が不足しています");
      expect(updated.steps[0].rejection?.occurredAt).toBeInstanceOf(OccurredAt);
    });

    it("withdraw で申請 WITHDRAWN（往復生存）", async () => {
      const variationId = await createVariationId(EN.withdraw);
      const saved = await repository.insert(buildApplication(variationId));

      saved.withdraw(new EmployeeId(ids.applicantEmployeeId));
      const updated = await repository.update(saved, 1);

      expect(updated.applicationStatus.value).toBe("WITHDRAWN");
      expect(updated.withdrawal).not.toBeNull();
      expect(updated.withdrawal?.occurredAt).toBeInstanceOf(OccurredAt);
    });

    it("stale な expectedVersion での update は ConflictError", async () => {
      const variationId = await createVariationId(EN.stale);
      const saved = await repository.insert(buildApplication(variationId));
      const approver = new EmployeeId(ids.approverEmployeeId);

      // 先行更新で DB version を 2 に進める
      saved.approve(saved.steps[0].id, approver);
      const advanced = await repository.update(saved, 1);

      // 進んだアグリゲートに次の変更を載せ、古い version 1 で更新を試みる
      advanced.approve(advanced.steps[1].id, approver);
      await expect(repository.update(advanced, 1)).rejects.toBeInstanceOf(ConflictError);
    });
  });
});
