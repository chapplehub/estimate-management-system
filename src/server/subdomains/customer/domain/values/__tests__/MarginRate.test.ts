import { describe, expect, it } from "vitest";
import { MarginRate } from "../MarginRate";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("MarginRate", () => {
  describe("正常系", () => {
    it("0%を受け入れる", () => {
      const rate = new MarginRate(0);
      expect(rate.value).toBe(0);
    });

    it("100%を受け入れる", () => {
      const rate = new MarginRate(100);
      expect(rate.value).toBe(100);
    });

    it("小数を受け入れる", () => {
      const rate = new MarginRate(10.5);
      expect(rate.value).toBe(10.5);
    });
  });

  describe("異常系", () => {
    it("負の値を拒否する", () => {
      expect(() => new MarginRate(-1)).toThrow(ValidationError);
    });

    it("100超の値を拒否する", () => {
      expect(() => new MarginRate(100.01)).toThrow(ValidationError);
    });

    it("NaNを拒否する", () => {
      expect(() => new MarginRate(NaN)).toThrow(ValidationError);
    });

    it("Infinityを拒否する", () => {
      expect(() => new MarginRate(Infinity)).toThrow(ValidationError);
    });
  });

  describe("equals", () => {
    it("同じ値は等しい", () => {
      const a = new MarginRate(10);
      const b = new MarginRate(10);
      expect(a.equals(b)).toBe(true);
    });

    it("異なる値は等しくない", () => {
      const a = new MarginRate(10);
      const b = new MarginRate(20);
      expect(a.equals(b)).toBe(false);
    });
  });
});
