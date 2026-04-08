import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { ComponentQuantity } from "../ComponentQuantity";

describe("ComponentQuantity", () => {
  // ========================================
  // 正常系
  // ========================================

  it("1を設定できる", () => {
    const qty = new ComponentQuantity(1);
    expect(qty.value).toBe(1);
  });

  it("大きな正の整数を設定できる", () => {
    const qty = new ComponentQuantity(9999);
    expect(qty.value).toBe(9999);
  });

  // ========================================
  // 異常系
  // ========================================

  it("0はエラーになる", () => {
    expect(() => new ComponentQuantity(0)).toThrow(ValidationError);
  });

  it("負の値はエラーになる", () => {
    expect(() => new ComponentQuantity(-1)).toThrow(ValidationError);
  });

  it("小数はエラーになる", () => {
    expect(() => new ComponentQuantity(1.5)).toThrow(ValidationError);
  });

  it("NaNはエラーになる", () => {
    expect(() => new ComponentQuantity(NaN)).toThrow(ValidationError);
  });
});
