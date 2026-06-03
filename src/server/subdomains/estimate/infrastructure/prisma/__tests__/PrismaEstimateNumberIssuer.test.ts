import {
  ensureEstimateFixtures,
  type EstimateFixtureIds,
} from "@server/__tests__/helpers/ensureEstimateFixtures";
import prisma from "@server/prisma";
import { FiscalYear } from "@server/shared/domain/values/FiscalYear";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { buildNewEstimate } from "@subdomains/estimate/domain/entities/__tests__/estimateAggregateBuilder";
import { EstimateType } from "@subdomains/estimate/domain/values/EstimateType";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaEstimateNumberIssuer } from "../PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "../PrismaEstimateRepository";

// 採番は「年度 × 種別の全行」を集約対象とするため、年度単位で隔離する。
// 2098 は他テスト（リポジトリテストは 99=2099 バンド）・実シードと衝突しない未使用年度。
const TEST_FISCAL_YEAR = 2098;
const fiscalYear = new FiscalYear(TEST_FISCAL_YEAR);

async function cleanupTestYear(): Promise<void> {
  await prisma.estimate.deleteMany({ where: { fiscalYear: TEST_FISCAL_YEAR } });
}

describe("PrismaEstimateNumberIssuer", () => {
  let issuer: PrismaEstimateNumberIssuer;
  let repository: PrismaEstimateRepository;
  let ids: EstimateFixtureIds;

  beforeAll(async () => {
    ids = await ensureEstimateFixtures();
  });

  beforeEach(async () => {
    issuer = new PrismaEstimateNumberIssuer();
    repository = new PrismaEstimateRepository();
    await cleanupTestYear();
  });

  afterAll(async () => {
    await cleanupTestYear();
  });

  it("該当年度・種別の見積が存在しない場合は連番 1 を払い出す", async () => {
    const number = await issuer.issueNext(fiscalYear, EstimateType.NEW);

    expect(number.value).toBe("N9800001");
    expect(number.sequence).toBe(1);
    expect(number.fiscalYear.value).toBe(TEST_FISCAL_YEAR);
  });

  it("既存の最大連番 + 1 を払い出す（欠番があっても MAX 基準）", async () => {
    // 連番 1 と 3 を保存（2 は欠番）→ MAX=3 なので次は 4
    await repository.save(buildNewEstimate(ids, "N9800001"));
    await repository.save(buildNewEstimate(ids, "N9800003"));

    const number = await issuer.issueNext(fiscalYear, EstimateType.NEW);

    expect(number.value).toBe("N9800004");
  });

  it("見積種別ごとに連番は独立して採番される", async () => {
    // NEW で連番 1 を消費しても、REPAIR は 1 から採番される
    await repository.save(buildNewEstimate(ids, "N9800001"));

    const repairNumber = await issuer.issueNext(fiscalYear, EstimateType.REPAIR);

    expect(repairNumber.value).toBe("R9800001");
  });

  it("連番が上限 99999 に達している場合は BusinessRuleViolationError を投げる", async () => {
    await repository.save(buildNewEstimate(ids, "N9899999"));

    await expect(issuer.issueNext(fiscalYear, EstimateType.NEW)).rejects.toThrow(
      BusinessRuleViolationError
    );
  });
});
