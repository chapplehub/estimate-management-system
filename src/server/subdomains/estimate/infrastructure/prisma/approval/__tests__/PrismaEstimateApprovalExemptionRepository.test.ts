import {
  cleanupApprovalFixtures,
  ensureApprovalFixtures,
  type ApprovalFixtureIds,
} from "@server/__tests__/helpers/ensureApprovalFixtures";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { PrismaTransactionRunner } from "@server/shared/infrastructure/transaction/PrismaTransactionRunner";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EstimateApprovalExemption } from "@subdomains/estimate/domain/entities";
import { buildNewEstimate } from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import { EstimateExemptionReason } from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaEstimateRepository } from "../../PrismaEstimateRepository";
import { PrismaEstimateApprovalExemptionRepository } from "../PrismaEstimateApprovalExemptionRepository";

// 予約済みテスト見積番号（承認系は N9907xxx を使用。既存リポジトリテストの N9900xxx と衝突しない）。
const EN = {
  roundtrip: "N9907001",
  conflict: "N9907002",
  txRollback: "N9907003",
} as const;
const ALL_NUMBERS = Object.values(EN);

describe("PrismaEstimateApprovalExemptionRepository", () => {
  let repository: PrismaEstimateApprovalExemptionRepository;
  let estimateRepository: PrismaEstimateRepository;
  let ids: ApprovalFixtureIds;

  beforeAll(async () => {
    ids = await ensureApprovalFixtures();
  });

  beforeEach(async () => {
    repository = new PrismaEstimateApprovalExemptionRepository();
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

  it("insert → findByVariationId で免除を等価に再構築できる", async () => {
    const variationId = await createVariationId(EN.roundtrip);
    const exemption = EstimateApprovalExemption.create(
      variationId,
      EstimateExemptionReason.BELOW_THRESHOLD,
      new EmployeeId(ids.exempterEmployeeId)
    );

    const saved = await repository.insert(exemption);

    const found = await repository.findByVariationId(variationId);
    expect(found).not.toBeNull();
    if (!found) return;
    expect(found.id.value).toBe(saved.id.value);
    expect(found.variationId.value).toBe(variationId.value);
    expect(found.reason.value).toBe("BELOW_THRESHOLD");
    expect(found.exemptedByEmployeeId.value).toBe(ids.exempterEmployeeId);
    // 免除日時は DB 既定（@default(now())）で確定し、refetch で復元される
    expect(found.createdAt).toBeInstanceOf(Date);
  });

  it("免除が無いバリエーションは findByVariationId で null", async () => {
    const variationId = await createVariationId(EN.roundtrip);

    const found = await repository.findByVariationId(variationId);

    expect(found).toBeNull();
  });

  it("同一バリエーションへの二重 insert は ConflictError", async () => {
    const variationId = await createVariationId(EN.conflict);
    const first = EstimateApprovalExemption.create(
      variationId,
      EstimateExemptionReason.CONSUMABLE_ONLY,
      new EmployeeId(ids.exempterEmployeeId)
    );
    await repository.insert(first);

    const second = EstimateApprovalExemption.create(
      variationId,
      EstimateExemptionReason.AFTER_REPAIR,
      new EmployeeId(ids.exempterEmployeeId)
    );

    await expect(repository.insert(second)).rejects.toBeInstanceOf(ConflictError);
  });

  it("ambient トランザクション内で insert 後に後続処理が失敗すると免除行がロールバックされる（atomic submit 基盤・ADR-0069）", async () => {
    const txRunner = new PrismaTransactionRunner();
    const variationId = await createVariationId(EN.txRollback);
    const exemption = EstimateApprovalExemption.create(
      variationId,
      EstimateExemptionReason.BELOW_THRESHOLD,
      new EmployeeId(ids.exempterEmployeeId)
    );

    // insert が currentClient() 経由で ambient tx に相乗りしていれば、後続の throw で
    // 免除行ごとロールバックされる（EXEMPT パスの atomic submit 原子性）。
    await expect(
      txRunner.run(async () => {
        await repository.insert(exemption);
        throw new Error("simulate downstream failure");
      })
    ).rejects.toThrow("simulate downstream failure");

    const found = await repository.findByVariationId(variationId);
    expect(found).toBeNull();
  });
});
