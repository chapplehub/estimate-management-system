import { Money } from "@server/shared/domain/values/Money";
import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { CostUnitPrice } from "../CostUnitPrice";

// 価格 VO の生成口は Money のみ。テストの円リテラルは厳密な値なので Money を介して包む。
const cost = (yen: number) => CostUnitPrice.fromMoney(Money.fromMajorUnits(yen));

describe("CostUnitPrice", () => {
  describe("生成", () => {
    it("Money から生成して金額を取り出せる", () => {
      expect(cost(1000).majorUnits).toBe(1000);
    });

    it("0円を許容する（非負）", () => {
      expect(cost(0).majorUnits).toBe(0);
    });

    it("小数2桁（銭）まで保持できる", () => {
      expect(cost(1234.56).majorUnits).toBe(1234.56);
    });

    it("負の Money は ValidationError", () => {
      expect(() => CostUnitPrice.fromMoney(Money.fromMajorUnits(-5))).toThrow(ValidationError);
    });
  });

  describe("等価", () => {
    it("同じ金額なら等価", () => {
      expect(cost(1000).equals(cost(1000))).toBe(true);
    });

    it("異なる金額なら非等価", () => {
      expect(cost(1000).equals(cost(2000))).toBe(false);
    });
  });
});
