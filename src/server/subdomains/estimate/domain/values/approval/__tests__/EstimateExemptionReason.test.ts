import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { EstimateExemptionReason } from "../EstimateExemptionReason";

describe("EstimateExemptionReason", () => {
  describe("static インスタンス", () => {
    it("CONSUMABLE_ONLY を取得できる", () => {
      expect(EstimateExemptionReason.CONSUMABLE_ONLY.value).toBe("CONSUMABLE_ONLY");
    });

    it("BELOW_THRESHOLD を取得できる", () => {
      expect(EstimateExemptionReason.BELOW_THRESHOLD.value).toBe("BELOW_THRESHOLD");
    });

    it("AFTER_REPAIR を取得できる", () => {
      expect(EstimateExemptionReason.AFTER_REPAIR.value).toBe("AFTER_REPAIR");
    });
  });

  describe("from() — Prisma 値からの生成", () => {
    it("'CONSUMABLE_ONLY' から同一インスタンスが返る", () => {
      expect(EstimateExemptionReason.from("CONSUMABLE_ONLY")).toBe(
        EstimateExemptionReason.CONSUMABLE_ONLY
      );
    });

    it("'BELOW_THRESHOLD' から同一インスタンスが返る", () => {
      expect(EstimateExemptionReason.from("BELOW_THRESHOLD")).toBe(
        EstimateExemptionReason.BELOW_THRESHOLD
      );
    });

    it("'AFTER_REPAIR' から同一インスタンスが返る", () => {
      expect(EstimateExemptionReason.from("AFTER_REPAIR")).toBe(
        EstimateExemptionReason.AFTER_REPAIR
      );
    });

    it("不正な値はエラー", () => {
      expect(() => EstimateExemptionReason.from("INVALID")).toThrow(ValidationError);
      expect(() => EstimateExemptionReason.from("INVALID")).toThrow("不正な免除理由です");
    });

    it("空文字はエラー", () => {
      expect(() => EstimateExemptionReason.from("")).toThrow(ValidationError);
    });
  });

  describe("label アクセサ", () => {
    it("CONSUMABLE_ONLY.label === '消耗品のみ'", () => {
      expect(EstimateExemptionReason.CONSUMABLE_ONLY.label).toBe("消耗品のみ");
    });

    it("BELOW_THRESHOLD.label === '10万円未満'", () => {
      expect(EstimateExemptionReason.BELOW_THRESHOLD.label).toBe("10万円未満");
    });

    it("AFTER_REPAIR.label === '事後見積'", () => {
      expect(EstimateExemptionReason.AFTER_REPAIR.label).toBe("事後見積");
    });
  });

  describe("equals", () => {
    it("from で取得しても同一インスタンスのため等価", () => {
      expect(
        EstimateExemptionReason.from("CONSUMABLE_ONLY").equals(
          EstimateExemptionReason.CONSUMABLE_ONLY
        )
      ).toBe(true);
    });

    it("異なる理由は非等価", () => {
      expect(
        EstimateExemptionReason.CONSUMABLE_ONLY.equals(EstimateExemptionReason.AFTER_REPAIR)
      ).toBe(false);
    });
  });
});
