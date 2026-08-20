import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { DiscountRate } from "../../values/DiscountRate";
import { Money } from "@server/shared/domain/values/Money";
import { Quantity } from "../../values/Quantity";
import { LineItemAmountPolicy } from "../LineItemAmountPolicy";

describe("LineItemAmountPolicy", () => {
  describe("正常系", () => {
    it("設計書§8.2の例を再現する（単価100,000円×数量1×掛率0.95−明細値引5,000円=90,000円）", () => {
      const result = LineItemAmountPolicy.calculate(
        Money.fromMajorUnits(100_000),
        new Quantity(1),
        new DiscountRate(0.95),
        Money.fromMajorUnits(5_000)
      );

      expect(result.baseAmount.majorUnits).toBe(100_000);
      expect(result.discountedAmount.majorUnits).toBe(95_000);
      expect(result.finalAmount.majorUnits).toBe(90_000);
    });

    it("数量倍が反映される（単価100円×数量3=基本金額300円）", () => {
      const result = LineItemAmountPolicy.calculate(
        Money.fromMajorUnits(100),
        new Quantity(3),
        new DiscountRate(1),
        Money.zero()
      );

      expect(result.baseAmount.majorUnits).toBe(300);
      expect(result.discountedAmount.majorUnits).toBe(300);
      expect(result.finalAmount.majorUnits).toBe(300);
    });

    it("掛率1.0（値引なし）で基本金額と掛率適用後金額が一致する", () => {
      const result = LineItemAmountPolicy.calculate(
        Money.fromMajorUnits(1_234),
        new Quantity(1),
        new DiscountRate(1),
        Money.zero()
      );

      expect(result.baseAmount.equals(result.discountedAmount)).toBe(true);
    });

    it("明細値引と掛率適用後金額が等しいとき最終金額が0円", () => {
      const result = LineItemAmountPolicy.calculate(
        Money.fromMajorUnits(1_000),
        new Quantity(1),
        new DiscountRate(1),
        Money.fromMajorUnits(1_000)
      );

      expect(result.finalAmount.isZero()).toBe(true);
    });

    it("掛率適用で生じた円未満端数を切り捨てる（単価101円×掛率0.95=95.95円→95円）", () => {
      const result = LineItemAmountPolicy.calculate(
        Money.fromMajorUnits(101),
        new Quantity(1),
        new DiscountRate(0.95),
        Money.zero()
      );

      expect(result.discountedAmount.majorUnits).toBe(95);
      expect(result.finalAmount.majorUnits).toBe(95);
    });
  });

  describe("異常系", () => {
    it("明細値引が掛率適用後金額より大きいときはエラー", () => {
      expect(() =>
        LineItemAmountPolicy.calculate(
          Money.fromMajorUnits(1_000),
          new Quantity(1),
          new DiscountRate(1),
          Money.fromMajorUnits(1_500)
        )
      ).toThrow(BusinessRuleViolationError);

      expect(() =>
        LineItemAmountPolicy.calculate(
          Money.fromMajorUnits(1_000),
          new Quantity(1),
          new DiscountRate(1),
          Money.fromMajorUnits(1_500)
        )
      ).toThrow("値引き後の金額がマイナスになります");
    });
  });
});
