import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { DiscountRate } from "../DiscountRate";

describe("DiscountRate", () => {
  describe("正常系", () => {
    it("掛率0.95でインスタンスを作成できる", () => {
      expect(new DiscountRate(0.95).value).toBe(0.95);
    });

    it("デフォルト相当の1.0（値引なし）で作成できる", () => {
      expect(new DiscountRate(1.0).value).toBe(1.0);
    });

    it("numerator は value を10^4倍した整数を返す（0.95 → 9500）", () => {
      expect(new DiscountRate(0.95).numerator).toBe(9500);
    });

    it("SCALE は4である", () => {
      expect(DiscountRate.SCALE).toBe(4);
    });

    it("小数点以下4桁まで指定できる", () => {
      expect(new DiscountRate(0.1234).numerator).toBe(1234);
    });

    it("最大値9.9999で作成できる", () => {
      expect(new DiscountRate(9.9999).numerator).toBe(99999);
    });
  });

  describe("異常系", () => {
    it("0はエラー", () => {
      expect(() => new DiscountRate(0)).toThrow(ValidationError);
      expect(() => new DiscountRate(0)).toThrow("掛率は0より大きい値で指定してください");
    });

    it("負数はエラー", () => {
      expect(() => new DiscountRate(-0.5)).toThrow(ValidationError);
      expect(() => new DiscountRate(-0.5)).toThrow("掛率は0より大きい値で指定してください");
    });

    it("最大値超過はエラー", () => {
      expect(() => new DiscountRate(10)).toThrow(ValidationError);
      expect(() => new DiscountRate(10)).toThrow("掛率は9.9999以下で指定してください");
    });

    it("小数点以下5桁はエラー", () => {
      expect(() => new DiscountRate(0.12345)).toThrow(ValidationError);
      expect(() => new DiscountRate(0.12345)).toThrow("掛率は小数点以下4桁までで指定してください");
    });
  });
});
