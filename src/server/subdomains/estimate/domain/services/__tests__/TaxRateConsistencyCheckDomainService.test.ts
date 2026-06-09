import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { PrismaTaxRateRepository } from "@subdomains/estimate/infrastructure/prisma/PrismaTaxRateRepository";
import { describe, expect, it } from "vitest";
import { TaxRateConsistencyCheckDomainService } from "../TaxRateConsistencyCheckDomainService";

/**
 * 本テストはシードの消費税率マスタ（史実2行）を前提とする:
 *   2014-04-01 00:00 JST → 0.080 (8%)
 *   2019-10-01 00:00 JST → 0.100 (10%)
 * 実リポジトリ + 実DB（既存 DomainService テストの流儀）で検証する。
 */
describe("TaxRateConsistencyCheckDomainService", () => {
  const service = new TaxRateConsistencyCheckDomainService(new PrismaTaxRateRepository());

  it("見積年月日と締切日が同一税率期間にあるとき consistent と税率を返す", async () => {
    const result = await service.check({
      estimateDate: new Date("2020-01-01T00:00:00+09:00"),
      deadline: new Date("2020-02-01T00:00:00+09:00"),
    });

    expect(result.kind).toBe("consistent");
    if (result.kind === "consistent") {
      expect(result.rate.value).toBe(0.1);
    }
  });

  it("見積年月日と締切日が税率変更(2019-10-01)をまたぐとき mismatch と両税率を返す", async () => {
    const result = await service.check({
      estimateDate: new Date("2018-01-01T00:00:00+09:00"),
      deadline: new Date("2020-01-01T00:00:00+09:00"),
    });

    expect(result.kind).toBe("mismatch");
    if (result.kind === "mismatch") {
      expect(result.estimateDateRate.value).toBe(0.08);
      expect(result.deadlineRate.value).toBe(0.1);
    }
  });

  it("いずれかの日付に適用税率が存在しないとき BusinessRuleViolationError を投げる", async () => {
    await expect(
      service.check({
        estimateDate: new Date("2013-01-01T00:00:00+09:00"),
        deadline: new Date("2020-01-01T00:00:00+09:00"),
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });
});
