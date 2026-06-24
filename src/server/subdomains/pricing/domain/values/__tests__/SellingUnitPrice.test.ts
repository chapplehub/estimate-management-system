import { Money } from "@server/shared/domain/values/Money";
import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { SellingUnitPrice } from "../SellingUnitPrice";

// 価格 VO の生成口は Money のみ。テストの円リテラルは厳密な値なので Money を介して包む。
const price = (yen: number) => SellingUnitPrice.fromMoney(Money.fromMajorUnits(yen));

describe("SellingUnitPrice", () => {
  describe("生成", () => {
    it("Money から生成して金額を取り出せる", () => {
      expect(price(1000).majorUnits).toBe(1000);
    });

    it("0円を許容する（非負）", () => {
      expect(price(0).majorUnits).toBe(0);
    });

    it("小数2桁（銭）まで保持できる", () => {
      expect(price(1234.56).majorUnits).toBe(1234.56);
    });

    it("負の Money は ValidationError", () => {
      expect(() => SellingUnitPrice.fromMoney(Money.fromMajorUnits(-5))).toThrow(ValidationError);
    });
  });

  describe("等価", () => {
    it("同じ金額なら等価", () => {
      expect(price(1000).equals(price(1000))).toBe(true);
    });

    it("異なる金額なら非等価", () => {
      expect(price(1000).equals(price(2000))).toBe(false);
    });
  });
});
