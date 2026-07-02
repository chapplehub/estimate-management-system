import {
  cleanupApprovalFixtures,
  ensureApprovalFixtures,
  type ApprovalFixtureIds,
} from "@server/__tests__/helpers/ensureApprovalFixtures";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
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
import { ApproveStepCommand } from "../ApproveStepCommand";

// 承認コマンド系テスト見積番号（withdraw の 02x と分けて 03x を使う）。
const EN = {
  approve: "N9907030",
  notMember: "N9907031",
  stale: "N9907032",
} as const;
const ALL_NUMBERS = Object.values(EN);

describe("ApproveStepCommand", () => {
  let command: ApproveStepCommand;
  let repository: PrismaEstimateApplicationRepository;
  let estimateRepository: PrismaEstimateRepository;
  let ids: ApprovalFixtureIds;

  beforeAll(async () => {
    ids = await ensureApprovalFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateApplicationRepository();
    estimateRepository = new PrismaEstimateRepository();
    command = new ApproveStepCommand(repository, new PrismaRoleQueryService());
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

  it("役割メンバーの承認者が先頭ステップを承認でき、当該ステップは APPROVED になる", async () => {
    const saved = await insertApplication(EN.approve);
    const firstStepId = saved.steps[0].id;

    const result = await command.execute({
      stepId: firstStepId.value,
      approverEmployeeId: ids.approverEmployeeId,
      expectedVersion: 1,
    });

    expect(result.stepStatus(firstStepId).value).toBe("APPROVED");
    // 2段チェーンのため申請はまだ PENDING（次ステップが AWAITING）。
    expect(result.applicationStatus.value).toBe("PENDING");
    expect(result.stepStatus(result.steps[1].id).value).toBe("AWAITING");

    const reloaded = await repository.findByStepId(firstStepId);
    expect(reloaded?.stepStatus(firstStepId).value).toBe("APPROVED");
  });

  it("役割メンバーでない者の承認はアプリ層の認可検証で拒否する", async () => {
    const saved = await insertApplication(EN.notMember);
    const firstStepId = saved.steps[0].id;

    await expect(
      command.execute({
        stepId: firstStepId.value,
        approverEmployeeId: ids.applicantEmployeeId, // ステップ役割の非メンバー
        expectedVersion: 1,
      })
    ).rejects.toThrow(BusinessRuleViolationError);

    // 承認は記録されない（申請は PENDING のまま）。
    const reloaded = await repository.findByStepId(firstStepId);
    expect(reloaded?.stepStatus(firstStepId).value).toBe("AWAITING");
  });

  it("stale な expectedVersion での承認は ConflictError（ADR-0039）", async () => {
    const saved = await insertApplication(EN.stale);
    const firstStepId = saved.steps[0].id;

    // 現 version は 1。存在しない古い version 0 で操作すると衝突。
    await expect(
      command.execute({
        stepId: firstStepId.value,
        approverEmployeeId: ids.approverEmployeeId,
        expectedVersion: 0,
      })
    ).rejects.toThrow(ConflictError);
  });

  it("存在しない stepId は NotFoundEntityError", async () => {
    await expect(
      command.execute({
        stepId: "00000000-0000-7000-8000-0000000005ff",
        approverEmployeeId: ids.approverEmployeeId,
        expectedVersion: 1,
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
