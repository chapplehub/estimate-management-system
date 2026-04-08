import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { ProductCode } from "../ProductCode";

describe("ProductCode", () => {
  // ========================================
  // 正常系
  // ========================================

  it("英数字の商品コードを作成できる", () => {
    const code = new ProductCode("ABC123");
    expect(code.value).toBe("ABC123");
  });

  it("小文字は大文字に変換される", () => {
    const code = new ProductCode("abc123");
    expect(code.value).toBe("ABC123");
  });

  it("前後の空白はトリムされる", () => {
    const code = new ProductCode("  ABC123  ");
    expect(code.value).toBe("ABC123");
  });

  it("50文字の商品コードを作成できる", () => {
    const code = new ProductCode("A".repeat(50));
    expect(code.value).toBe("A".repeat(50));
  });

  // ========================================
  // 異常系
  // ========================================

  it("空文字はエラーになる", () => {
    expect(() => new ProductCode("")).toThrow(ValidationError);
  });

  it("空白のみはエラーになる", () => {
    expect(() => new ProductCode("   ")).toThrow(ValidationError);
  });

  it("51文字以上はエラーになる", () => {
    expect(() => new ProductCode("A".repeat(51))).toThrow(ValidationError);
    expect(() => new ProductCode("A".repeat(51))).toThrow("50文字以内");
  });

  it("英数字以外を含む場合はエラーになる", () => {
    expect(() => new ProductCode("ABC-123")).toThrow(ValidationError);
  });

  it("日本語を含む場合はエラーになる", () => {
    expect(() => new ProductCode("商品A")).toThrow(ValidationError);
  });

  it("記号を含む場合はエラーになる", () => {
    expect(() => new ProductCode("ABC@123")).toThrow(ValidationError);
  });
});
