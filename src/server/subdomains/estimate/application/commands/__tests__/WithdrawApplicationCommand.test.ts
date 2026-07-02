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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaEstimateApplicationRepository } from "../../../infrastructure/prisma/approval/PrismaEstimateApplicationRepository";
import { PrismaEstimateRepository } from "../../../infrastructure/prisma/PrismaEstimateRepository";
import { WithdrawApplicationCommand } from "../WithdrawApplicationCommand";

// 承認コマンド系テスト見積番号（リポジトリテストの 01x と分けて 02x を使う）。
const EN = {
  withdraw: "N9907020",
  notApplicant: "N9907021",
  stale: "N9907022",
} as const;
const ALL_NUMBERS = Object.values(EN);

describe("WithdrawApplicationCommand", () => {
  let command: WithdrawApplicationCommand;
  let repository: PrismaEstimateApplicationRepository;
  let estimateRepository: PrismaEstimateRepository;
  let ids: ApprovalFixtureIds;

  beforeAll(async () => {
    ids = await ensureApprovalFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateApplicationRepository();
    estimateRepository = new PrismaEstimateRepository();
    command = new WithdrawApplicationCommand(repository);
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

  /** PENDING な新規申請を DB へ挿入して返す。 */
  async function insertApplication(estimateNumber: string): Promise<EstimateApplication> {
    const variationId = await createVariationId(estimateNumber);
    const application = EstimateApplication.create({
      variationId,
      attempt: 1,
      applicantEmployeeId: new EmployeeId(ids.applicantEmployeeId),
      plan: ApprovalChainPlan.create(
        new PositionId(ids.goalPositionId),
        ids.stepRoleIds.map((id) => new RoleId(id))
      ),
    });
    return repository.insert(application);
  }

  it("申請者本人が取下でき、申請は WITHDRAWN になる", async () => {
    const saved = await insertApplication(EN.withdraw);

    const result = await command.execute({
      applicationId: saved.id.value,
      operatorEmployeeId: ids.applicantEmployeeId,
      expectedVersion: 1,
    });

    expect(result.applicationStatus.value).toBe("WITHDRAWN");
    expect(result.withdrawal).not.toBeNull();

    const reloaded = await repository.findById(saved.id);
    expect(reloaded?.applicationStatus.value).toBe("WITHDRAWN");
  });

  it("申請者本人でない operator の取下はドメインガードで拒否する", async () => {
    const saved = await insertApplication(EN.notApplicant);

    await expect(
      command.execute({
        applicationId: saved.id.value,
        operatorEmployeeId: ids.approverEmployeeId, // 申請者ではない
        expectedVersion: 1,
      })
    ).rejects.toThrow(BusinessRuleViolationError);

    // 取下は記録されない。
    const reloaded = await repository.findById(saved.id);
    expect(reloaded?.applicationStatus.value).toBe("PENDING");
  });

  it("stale な expectedVersion での取下は ConflictError（ADR-0039）", async () => {
    const saved = await insertApplication(EN.stale);

    // 現 version は 1。存在しない古い version 0 で操作すると衝突。
    await expect(
      command.execute({
        applicationId: saved.id.value,
        operatorEmployeeId: ids.applicantEmployeeId,
        expectedVersion: 0,
      })
    ).rejects.toThrow(ConflictError);
  });

  it("存在しない applicationId は NotFoundEntityError", async () => {
    await expect(
      command.execute({
        applicationId: "00000000-0000-7000-8000-0000000004ff",
        operatorEmployeeId: ids.applicantEmployeeId,
        expectedVersion: 1,
      })
    ).rejects.toThrow(NotFoundEntityError);
  });
});
