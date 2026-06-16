import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { SetComponentRule, type SetComponentFact } from "../SetComponentRule";

function fact(overrides: Partial<SetComponentFact> = {}): SetComponentFact {
  return {
    productId: "00000000-0000-7000-8000-000000000001",
    itemName: "構成商品",
    category: "INDIVIDUAL",
    isActive: true,
    ...overrides,
  };
}

describe("SetComponentRule", () => {
  describe("区分検証（ハードエラー）", () => {
    it("構成商品が個別商品・消耗品のみなら警告なしで通る", () => {
      const warnings = SetComponentRule.validate([
        fact({ category: "INDIVIDUAL" }),
        fact({ category: "CONSUMABLE" }),
      ]);

      expect(warnings).toEqual([]);
    });

    it("構成商品にセット商品を指定するとハードエラー（ネスト禁止）", () => {
      expect(() => SetComponentRule.validate([fact({ category: "SET" })])).toThrow(
        BusinessRuleViolationError
      );
    });

    it("未知の区分文字列もハードエラー（許可外）", () => {
      expect(() => SetComponentRule.validate([fact({ category: "UNKNOWN" })])).toThrow(
        BusinessRuleViolationError
      );
    });
  });

  describe("無効構成の警告（非ブロッキング）", () => {
    it("無効構成商品は throw せず warning として返す", () => {
      const warnings = SetComponentRule.validate([
        fact({ productId: "p-active", isActive: true }),
        fact({ productId: "p-inactive", isActive: false }),
      ]);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].productId).toBe("p-inactive");
      expect(warnings[0].reason).toBe("INACTIVE");
    });

    it("区分が許可内であれば無効でも warning に留まる（追加・保存は許す）", () => {
      const warnings = SetComponentRule.validate([
        fact({ category: "CONSUMABLE", isActive: false }),
      ]);

      expect(warnings).toHaveLength(1);
    });
  });

  it("区分違反は無効警告より優先して throw する（不正構造は保存させない）", () => {
    expect(() => SetComponentRule.validate([fact({ category: "SET", isActive: false })])).toThrow(
      BusinessRuleViolationError
    );
  });
});
