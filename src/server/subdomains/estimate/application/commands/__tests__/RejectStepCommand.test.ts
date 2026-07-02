import {
  cleanupApprovalFixtures,
  ensureApprovalFixtures,
  type ApprovalFixtureIds,
} from "@server/__tests__/helpers/ensureApprovalFixtures";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { EstimateApplication } from "@subdomains/estimate/domain/entities";
import { buildNewEstimate } from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import { ApprovalChainPlan } from "@subdomains/estimate/domain/values/approval/ApprovalChainPlan";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaEstimateApplicationRepository } from "../../../infrastructure/prisma/approval/PrismaEstimateApplicationRepository";
import { PrismaEstimateRepository } from "../../../infrastructure/prisma/PrismaEstimateRepository";
import { RejectStepCommand } from "../RejectStepCommand";

// 承認コマンド系テスト見積番号（approve の 03x と分けて 04x を使う）。
const EN = {
  reject: "N9907040",
  notMember: "N9907041",
  emptyComment: "N9907042",
  stale: "N9907043",
} as const;
const ALL_NUMBERS = Object.values(EN);

describe("RejectStepCommand", () => {
  let command: RejectStepCommand;
  let repository: PrismaEstimateApplicationRepository;
  let estimateRepository: PrismaEstimateRepository;
  let ids: ApprovalFixtureIds;

  beforeAll(async () => {
    ids = await ensureApprovalFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateApplicationRepository();
    estimateRepository = new PrismaEstimateRepository();
    command = new RejectStepCommand(repository, new PrismaRoleQueryService());
    await cleanupApprovalFixtures(ALL_NUMBERS);
  });

  afterAll(async () => {
    await cleanupApprovalFixtures(ALL_NUMBERS);
  });

  /** PENDING な新規申請を DB へ挿入して返す。 */
  async function insertApplication(estimateNumber: string): Promise<EstimateApplication> {
    const estimate = await estimateRepository.insert(
      buildNewEstimate(ids.estimate, estimateNumber)
    );
    const variationId = estimate.variations[0].id;
    const application = EstimateApplication.create({
      variationId: new EstimateVariationId(variationId.value),
      attempt: 1,
      applicantEmployeeId: new EmployeeId(ids.applicantEmployeeId),
      plan: ApprovalChainPlan.create(
        new PositionId(ids.goalPositionId),
        ids.stepRoleIds.map((id) => new RoleId(id))
      ),
    });
    return repository.insert(application);
  }

  it("役割メンバーの差戻者が先頭ステップを差戻でき、申請は REJECTED になる", async () => {
    const saved = await insertApplication(EN.reject);
    const firstStepId = saved.steps[0].id;

    const result = await command.execute({
      stepId: firstStepId.value,
      rejecterEmployeeId: ids.approverEmployeeId,
      comment: "金額の根拠が不足しています",
      expectedVersion: 1,
    });

    expect(result.stepStatus(firstStepId).value).toBe("REJECTED");
    expect(result.applicationStatus.value).toBe("REJECTED");

    const reloaded = await repository.findByStepId(firstStepId);
    expect(reloaded?.stepStatus(firstStepId).value).toBe("REJECTED");
    expect(reloaded?.steps[0].rejection?.comment.value).toBe("金額の根拠が不足しています");
  });

  it("役割メンバーでない者の差戻はアプリ層の認可検証で拒否する", async () => {
    const saved = await insertApplication(EN.notMember);
    const firstStepId = saved.steps[0].id;

    await expect(
      command.execute({
        stepId: firstStepId.value,
        rejecterEmployeeId: ids.applicantEmployeeId, // ステップ役割の非メンバー
        comment: "却下します",
        expectedVersion: 1,
      })
    ).rejects.toThrow(BusinessRuleViolationError);

    const reloaded = await repository.findByStepId(firstStepId);
    expect(reloaded?.stepStatus(firstStepId).value).toBe("AWAITING");
  });

  it("空コメントの差戻は VO 構築時に ValidationError（必須・1〜2000字）", async () => {
    const saved = await insertApplication(EN.emptyComment);
    const firstStepId = saved.steps[0].id;

    await expect(
      command.execute({
        stepId: firstStepId.value,
        rejecterEmployeeId: ids.approverEmployeeId,
        comment: "   ", // trim 後は空
        expectedVersion: 1,
      })
    ).rejects.toThrow(ValidationError);

    const reloaded = await repository.findByStepId(firstStepId);
    expect(reloaded?.stepStatus(firstStepId).value).toBe("AWAITING");
  });

  it("stale な expectedVersion での差戻は ConflictError（ADR-0039）", async () => {
    const saved = await insertApplication(EN.stale);
    const firstStepId = saved.steps[0].id;

    // 現 version は 1。存在しない古い version 0 で操作すると衝突。
    await expect(
      command.execute({
        stepId: firstStepId.value,
        rejecterEmployeeId: ids.approverEmployeeId,
        comment: "やり直し",
        expectedVersion: 0,
      })
    ).rejects.toThrow(ConflictError);
  });

  it("存在しない stepId は NotFoundEntityError", async () => {
    await expect(
      command.execute({
        stepId: "00000000-0000-7000-8000-0000000006ff",
        rejecterEmployeeId: ids.approverEmployeeId,
        comment: "対象なし",
        expectedVersion: 1,
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
