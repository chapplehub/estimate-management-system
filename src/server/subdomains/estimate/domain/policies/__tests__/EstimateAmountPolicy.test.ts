import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Money } from "../../values/Money";
import { TaxRate } from "../../values/TaxRate";
import { TaxRoundingType } from "../../values/TaxRoundingType";
import { EstimateAmountPolicy } from "../EstimateAmountPolicy";

describe("EstimateAmountPolicy", () => {
  describe("正常系", () => {
    it("§8.2の例の流れを再現する（明細小計1,000,000−全体値引50,000、税率10%切捨）", () => {
      const result = EstimateAmountPolicy.calculate({
        finalLineAmounts: [
          Money.fromMajorUnits(400_000),
          Money.fromMajorUnits(300_000),
          Money.fromMajorUnits(300_000),
        ],
        overallDiscount: Money.fromMajorUnits(50_000),
        taxRate: new TaxRate(0.1),
        taxRoundingType: TaxRoundingType.ROUND_DOWN,
      });

      expect(result.subtotal.majorUnits).toBe(1_000_000);
      expect(result.afterOverallDiscount.majorUnits).toBe(950_000);
      expect(result.taxAmount.majorUnits).toBe(95_000);
      expect(result.finalTotal.majorUnits).toBe(1_045_000);
    });

    it("0明細でも例外を投げず subtotal=0、税額=0、最終合計=0 になる", () => {
      const result = EstimateAmountPolicy.calculate({
        finalLineAmounts: [],
        overallDiscount: Money.zero(),
        taxRate: new TaxRate(0.1),
        taxRoundingType: TaxRoundingType.ROUND_DOWN,
      });

      expect(result.subtotal.isZero()).toBe(true);
      expect(result.taxAmount.isZero()).toBe(true);
      expect(result.finalTotal.isZero()).toBe(true);
    });

    it("ROUND_DOWN で円未満を切り捨てる（995円×10%=99.5円→99円）", () => {
      const result = EstimateAmountPolicy.calculate({
        finalLineAmounts: [Money.fromMajorUnits(995)],
        overallDiscount: Money.zero(),
        taxRate: new TaxRate(0.1),
        taxRoundingType: TaxRoundingType.ROUND_DOWN,
      });

      expect(result.taxAmount.majorUnits).toBe(99);
      expect(result.finalTotal.majorUnits).toBe(1_094);
    });

    it("ROUND_UP で円未満を切り上げる（995円×10%=99.5円→100円）", () => {
      const result = EstimateAmountPolicy.calculate({
        finalLineAmounts: [Money.fromMajorUnits(995)],
        overallDiscount: Money.zero(),
        taxRate: new TaxRate(0.1),
        taxRoundingType: TaxRoundingType.ROUND_UP,
      });

      expect(result.taxAmount.majorUnits).toBe(100);
      expect(result.finalTotal.majorUnits).toBe(1_095);
    });

    it("ROUND で四捨五入する（995円×10%=99.5円→100円）", () => {
      const result = EstimateAmountPolicy.calculate({
        finalLineAmounts: [Money.fromMajorUnits(995)],
        overallDiscount: Money.zero(),
        taxRate: new TaxRate(0.1),
        taxRoundingType: TaxRoundingType.ROUND,
      });

      expect(result.taxAmount.majorUnits).toBe(100);
      expect(result.finalTotal.majorUnits).toBe(1_095);
    });

    it("税率0（非課税）で税額が0になる", () => {
      const result = EstimateAmountPolicy.calculate({
        finalLineAmounts: [Money.fromMajorUnits(10_000)],
        overallDiscount: Money.zero(),
        taxRate: new TaxRate(0),
        taxRoundingType: TaxRoundingType.ROUND_DOWN,
      });

      expect(result.taxAmount.isZero()).toBe(true);
      expect(result.finalTotal.majorUnits).toBe(10_000);
    });

    it("全体値引と小計が等しいとき税額0・最終合計0になる", () => {
      const result = EstimateAmountPolicy.calculate({
        finalLineAmounts: [Money.fromMajorUnits(1_000)],
        overallDiscount: Money.fromMajorUnits(1_000),
        taxRate: new TaxRate(0.1),
        taxRoundingType: TaxRoundingType.ROUND_DOWN,
      });

      expect(result.afterOverallDiscount.isZero()).toBe(true);
      expect(result.taxAmount.isZero()).toBe(true);
      expect(result.finalTotal.isZero()).toBe(true);
    });
  });

  describe("異常系", () => {
    it("全体値引が明細小計より大きいときはエラー", () => {
      expect(() =>
        EstimateAmountPolicy.calculate({
          finalLineAmounts: [Money.fromMajorUnits(1_000)],
          overallDiscount: Money.fromMajorUnits(2_000),
          taxRate: new TaxRate(0.1),
          taxRoundingType: TaxRoundingType.ROUND_DOWN,
        })
      ).toThrow(BusinessRuleViolationError);

      expect(() =>
        EstimateAmountPolicy.calculate({
          finalLineAmounts: [Money.fromMajorUnits(1_000)],
          overallDiscount: Money.fromMajorUnits(2_000),
          taxRate: new TaxRate(0.1),
          taxRoundingType: TaxRoundingType.ROUND_DOWN,
        })
      ).toThrow("値引き後の金額がマイナスになります");
    });
  });
});
