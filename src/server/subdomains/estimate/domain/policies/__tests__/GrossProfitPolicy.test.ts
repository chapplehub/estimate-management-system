import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Money } from "@server/shared/domain/values/Money";
import { GrossProfitPolicy } from "../GrossProfitPolicy";

describe("GrossProfitPolicy", () => {
  describe("正常系", () => {
    it("§8.4の例を再現する（納品先1,200,000円・得意先1,000,000円 → 粗利200,000円・粗利率16.7%）", () => {
      const result = GrossProfitPolicy.calculate(
        Money.fromMajorUnits(1_200_000),
        Money.fromMajorUnits(1_000_000)
      );

      expect(result.grossProfit.majorUnits).toBe(200_000);
      expect(result.grossProfitRate).toBeCloseTo(0.1667, 4);
    });

    it("納品先価格と得意先価格が等しいとき粗利0・粗利率0", () => {
      const result = GrossProfitPolicy.calculate(
        Money.fromMajorUnits(1_000_000),
        Money.fromMajorUnits(1_000_000)
      );

      expect(result.grossProfit.isZero()).toBe(true);
      expect(result.grossProfitRate).toBe(0);
    });

    it("逆ザヤ（得意先価格 > 納品先価格）で粗利・粗利率がともに負になる", () => {
      const result = GrossProfitPolicy.calculate(
        Money.fromMajorUnits(1_000_000),
        Money.fromMajorUnits(1_200_000)
      );

      expect(result.grossProfit.majorUnits).toBe(-200_000);
      expect(result.grossProfit.isNegative()).toBe(true);
      expect(result.grossProfitRate).toBeCloseTo(-0.2, 4);
    });
  });

  describe("異常系", () => {
    it("納品先価格が0のときはエラー（ゼロ除算防御）", () => {
      expect(() => GrossProfitPolicy.calculate(Money.zero(), Money.zero())).toThrow(
        BusinessRuleViolationError
      );
      expect(() => GrossProfitPolicy.calculate(Money.zero(), Money.zero())).toThrow(
        "納品先価格が0の場合、粗利率を計算できません"
      );
    });
  });
});
