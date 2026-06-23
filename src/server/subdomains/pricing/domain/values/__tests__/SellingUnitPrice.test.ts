import { Money } from "@server/shared/domain/values/Money";
import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { SellingUnitPrice } from "../SellingUnitPrice";

describe("SellingUnitPrice", () => {
  describe("生成", () => {
    it("主単位（円）から生成して金額を取り出せる", () => {
      const price = SellingUnitPrice.fromMajorUnits(1000);
      expect(price.majorUnits).toBe(1000);
    });

    it("0円を許容する（非負）", () => {
      expect(SellingUnitPrice.fromMajorUnits(0).majorUnits).toBe(0);
    });

    it("小数2桁（銭）まで保持できる", () => {
      expect(SellingUnitPrice.fromMajorUnits(1234.56).majorUnits).toBe(1234.56);
    });

    it("負の金額は ValidationError", () => {
      expect(() => SellingUnitPrice.fromMajorUnits(-1)).toThrow(ValidationError);
    });

    it("Money から生成できる", () => {
      const price = SellingUnitPrice.fromMoney(Money.fromMajorUnits(2000));
      expect(price.majorUnits).toBe(2000);
    });

    it("負の Money は ValidationError", () => {
      expect(() => SellingUnitPrice.fromMoney(Money.fromMajorUnits(-5))).toThrow(ValidationError);
    });
  });

  describe("等価", () => {
    it("同じ金額なら等価", () => {
      expect(
        SellingUnitPrice.fromMajorUnits(1000).equals(SellingUnitPrice.fromMajorUnits(1000))
      ).toBe(true);
    });

    it("異なる金額なら非等価", () => {
      expect(
        SellingUnitPrice.fromMajorUnits(1000).equals(SellingUnitPrice.fromMajorUnits(2000))
      ).toBe(false);
    });
  });
});
