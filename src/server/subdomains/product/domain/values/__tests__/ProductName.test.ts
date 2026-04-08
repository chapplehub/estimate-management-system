import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { ProductName } from "../ProductName";

describe("ProductName", () => {
  // ========================================
  // 正常系
  // ========================================

  it("商品名を作成できる", () => {
    const name = new ProductName("テスト商品");
    expect(name.value).toBe("テスト商品");
  });

  it("前後の空白はトリムされる", () => {
    const name = new ProductName("  テスト商品  ");
    expect(name.value).toBe("テスト商品");
  });

  it("100文字の商品名を作成できる", () => {
    const name = new ProductName("あ".repeat(100));
    expect(name.value).toBe("あ".repeat(100));
  });

  // ========================================
  // 異常系
  // ========================================

  it("空文字はエラーになる", () => {
    expect(() => new ProductName("")).toThrow(ValidationError);
  });

  it("空白のみはエラーになる", () => {
    expect(() => new ProductName("   ")).toThrow(ValidationError);
  });

  it("101文字以上はエラーになる", () => {
    expect(() => new ProductName("あ".repeat(101))).toThrow(ValidationError);
    expect(() => new ProductName("あ".repeat(101))).toThrow("100文字以内");
  });
});
