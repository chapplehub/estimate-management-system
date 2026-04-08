import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { CostPrice } from "../CostPrice";

describe("CostPrice", () => {
  // ========================================
  // 正常系
  // ========================================

  it("0を設定できる", () => {
    const price = new CostPrice(0);
    expect(price.value).toBe(0);
  });

  it("正の整数を設定できる", () => {
    const price = new CostPrice(1000);
    expect(price.value).toBe(1000);
  });

  it("小数点以下2桁まで設定できる", () => {
    const price = new CostPrice(99.99);
    expect(price.value).toBe(99.99);
  });

  it("小数点以下1桁を設定できる", () => {
    const price = new CostPrice(100.5);
    expect(price.value).toBe(100.5);
  });

  // ========================================
  // 異常系
  // ========================================

  it("負の値はエラーになる", () => {
    expect(() => new CostPrice(-1)).toThrow(ValidationError);
  });

  it("小数点以下3桁はエラーになる", () => {
    expect(() => new CostPrice(10.123)).toThrow(ValidationError);
  });

  it("NaNはエラーになる", () => {
    expect(() => new CostPrice(NaN)).toThrow(ValidationError);
  });

  it("Infinityはエラーになる", () => {
    expect(() => new CostPrice(Infinity)).toThrow(ValidationError);
  });
});
