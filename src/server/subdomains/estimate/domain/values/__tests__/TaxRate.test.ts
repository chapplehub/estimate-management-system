import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { TaxRate } from "../TaxRate";

describe("TaxRate", () => {
  describe("正常系", () => {
    it("税率0.1（10%）でインスタンスを作成できる", () => {
      expect(new TaxRate(0.1).value).toBe(0.1);
    });

    it("税率0.08（8%）で作成できる", () => {
      expect(new TaxRate(0.08).value).toBe(0.08);
    });

    it("税率0（非課税）で作成できる", () => {
      expect(new TaxRate(0).value).toBe(0);
    });

    it("numerator は value を10^3倍した整数を返す（0.1 → 100）", () => {
      expect(new TaxRate(0.1).numerator).toBe(100);
    });

    it("numerator（0.08 → 80）", () => {
      expect(new TaxRate(0.08).numerator).toBe(80);
    });

    it("SCALE は3である", () => {
      expect(TaxRate.SCALE).toBe(3);
    });
  });

  describe("異常系", () => {
    it("負数はエラー", () => {
      expect(() => new TaxRate(-0.1)).toThrow(ValidationError);
      expect(() => new TaxRate(-0.1)).toThrow("消費税率は0以上で指定してください");
    });

    it("最大値超過はエラー", () => {
      expect(() => new TaxRate(10)).toThrow(ValidationError);
      expect(() => new TaxRate(10)).toThrow("消費税率は9.999以下で指定してください");
    });

    it("小数点以下4桁はエラー", () => {
      expect(() => new TaxRate(0.0825)).toThrow(ValidationError);
      expect(() => new TaxRate(0.0825)).toThrow("消費税率は小数点以下3桁までで指定してください");
    });
  });
});
