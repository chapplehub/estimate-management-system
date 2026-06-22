import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { describe, expect, it } from "vitest";
import { ApprovalRequirementPolicy } from "../ApprovalRequirementPolicy";
import { ApprovalGoalTier } from "../../../values/approval/ApprovalGoalTier";
import { EstimateExemptionReason } from "../../../values/approval/EstimateExemptionReason";
import { EstimateType } from "../../../values/EstimateType";
import { Money } from "../../../values/Money";

const yen = (amount: number) => Money.fromMajorUnits(amount);
const judge = (input: {
  finalTotal: Money;
  leafCategories?: ProductCategory[];
  estimateType?: EstimateType;
}) =>
  ApprovalRequirementPolicy.judge({
    finalTotal: input.finalTotal,
    leafCategories: input.leafCategories ?? [ProductCategory.INDIVIDUAL],
    estimateType: input.estimateType ?? EstimateType.NEW,
  });

describe("ApprovalRequirementPolicy", () => {
  describe("免除（§4.2 上から評価し最初に一致）", () => {
    it("事後見積は金額・区分に関わらず AFTER_REPAIR で免除", () => {
      const result = judge({
        finalTotal: yen(50_000_000),
        leafCategories: [ProductCategory.INDIVIDUAL],
        estimateType: EstimateType.AFTER_REPAIR,
      });

      expect(result.kind).toBe("EXEMPT");
      if (result.kind === "EXEMPT") {
        expect(result.reason.equals(EstimateExemptionReason.AFTER_REPAIR)).toBe(true);
      }
    });

    it("消耗品のみは金額無関係で CONSUMABLE_ONLY 免除（高額でも・ADR-0004）", () => {
      const result = judge({
        finalTotal: yen(50_000_000),
        leafCategories: [ProductCategory.CONSUMABLE, ProductCategory.CONSUMABLE],
      });

      expect(result.kind).toBe("EXEMPT");
      if (result.kind === "EXEMPT") {
        expect(result.reason.equals(EstimateExemptionReason.CONSUMABLE_ONLY)).toBe(true);
      }
    });

    it("10万円未満は BELOW_THRESHOLD で免除", () => {
      const result = judge({ finalTotal: yen(99_999) });

      expect(result.kind).toBe("EXEMPT");
      if (result.kind === "EXEMPT") {
        expect(result.reason.equals(EstimateExemptionReason.BELOW_THRESHOLD)).toBe(true);
      }
    });

    it("事後見積は消耗品判定より優先される（評価順）", () => {
      const result = judge({
        finalTotal: yen(200_000),
        leafCategories: [ProductCategory.CONSUMABLE],
        estimateType: EstimateType.AFTER_REPAIR,
      });

      expect(result.kind).toBe("EXEMPT");
      if (result.kind === "EXEMPT") {
        expect(result.reason.equals(EstimateExemptionReason.AFTER_REPAIR)).toBe(true);
      }
    });

    it("消耗品と個別商品が混在すれば消耗品のみ免除にならない", () => {
      const result = judge({
        finalTotal: yen(200_000),
        leafCategories: [ProductCategory.CONSUMABLE, ProductCategory.INDIVIDUAL],
      });

      expect(result.kind).toBe("REQUIRED");
    });
  });

  describe("承認必要 - 金額境界（§4.2・税込・ADR-0055）", () => {
    const requiredTier = (amount: number): ApprovalGoalTier => {
      const result = judge({ finalTotal: yen(amount) });
      if (result.kind !== "REQUIRED") {
        throw new Error(`expected REQUIRED at ${amount}`);
      }
      return result.goalTier;
    };

    it("10万円ちょうどは課長", () => {
      expect(requiredTier(100_000).equals(ApprovalGoalTier.SECTION_MANAGER)).toBe(true);
    });

    it("100万円未満は課長", () => {
      expect(requiredTier(999_999).equals(ApprovalGoalTier.SECTION_MANAGER)).toBe(true);
    });

    it("100万円ちょうどは部長", () => {
      expect(requiredTier(1_000_000).equals(ApprovalGoalTier.DEPARTMENT_MANAGER)).toBe(true);
    });

    it("1000万円未満は部長", () => {
      expect(requiredTier(9_999_999).equals(ApprovalGoalTier.DEPARTMENT_MANAGER)).toBe(true);
    });

    it("1000万円ちょうどは本部長", () => {
      expect(requiredTier(10_000_000).equals(ApprovalGoalTier.DIVISION_MANAGER)).toBe(true);
    });

    it("3000万円未満は本部長", () => {
      expect(requiredTier(29_999_999).equals(ApprovalGoalTier.DIVISION_MANAGER)).toBe(true);
    });

    it("3000万円ちょうどは社長", () => {
      expect(requiredTier(30_000_000).equals(ApprovalGoalTier.PRESIDENT)).toBe(true);
    });
  });
});
