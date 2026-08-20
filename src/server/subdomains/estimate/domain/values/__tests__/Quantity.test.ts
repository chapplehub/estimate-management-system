import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Quantity } from "../Quantity";

describe("Quantity", () => {
  describe("正常系", () => {
    it("正の整数でインスタンスを作成できる", () => {
      expect(new Quantity(5).value).toBe(5);
    });

    it("最小値1で作成できる", () => {
      expect(new Quantity(1).value).toBe(1);
    });

    it("同じ数量は等価である", () => {
      expect(new Quantity(3).equals(new Quantity(3))).toBe(true);
    });
  });

  describe("異常系", () => {
    it("0はエラー", () => {
      expect(() => new Quantity(0)).toThrow(ValidationError);
      expect(() => new Quantity(0)).toThrow("数量は1以上の整数で指定してください");
    });

    it("負数はエラー", () => {
      expect(() => new Quantity(-1)).toThrow(ValidationError);
      expect(() => new Quantity(-1)).toThrow("数量は1以上の整数で指定してください");
    });

    it("小数はエラー", () => {
      expect(() => new Quantity(1.5)).toThrow(ValidationError);
      expect(() => new Quantity(1.5)).toThrow("数量は1以上の整数で指定してください");
    });

    it("NaNはエラー", () => {
      expect(() => new Quantity(NaN)).toThrow(ValidationError);
      expect(() => new Quantity(NaN)).toThrow("数量は有効な数値で指定してください");
    });
  });
});
