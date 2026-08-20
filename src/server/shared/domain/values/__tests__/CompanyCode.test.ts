import { describe, expect, it } from "vitest";
import { CompanyCode } from "../CompanyCode";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("CompanyCode", () => {
  describe("正常系", () => {
    it("英数字のコードを受け入れる", () => {
      const code = new CompanyCode("CUST001");
      expect(code.value).toBe("CUST001");
    });

    it("ハイフンを含むコードを受け入れる", () => {
      const code = new CompanyCode("ABC-123");
      expect(code.value).toBe("ABC-123");
    });

    it("アンダースコアを含むコードを受け入れる", () => {
      const code = new CompanyCode("ABC_123");
      expect(code.value).toBe("ABC_123");
    });

    it("小文字は大文字に正規化される", () => {
      const code = new CompanyCode("cust001");
      expect(code.value).toBe("CUST001");
    });

    it("前後の空白はトリムされる", () => {
      const code = new CompanyCode("  CUST001  ");
      expect(code.value).toBe("CUST001");
    });

    it("1文字のコードを受け入れる", () => {
      const code = new CompanyCode("A");
      expect(code.value).toBe("A");
    });

    it("20文字のコードを受け入れる", () => {
      const code = new CompanyCode("A".repeat(20));
      expect(code.value).toBe("A".repeat(20));
    });
  });

  describe("異常系", () => {
    it("空文字を拒否する", () => {
      expect(() => new CompanyCode("")).toThrow(ValidationError);
      expect(() => new CompanyCode("")).toThrow("取引先コードは必須です");
    });

    it("21文字以上を拒否する", () => {
      expect(() => new CompanyCode("A".repeat(21))).toThrow(ValidationError);
      expect(() => new CompanyCode("A".repeat(21))).toThrow(
        "取引先コードは20文字以内で入力してください"
      );
    });

    it("日本語を拒否する", () => {
      expect(() => new CompanyCode("得意先001")).toThrow(ValidationError);
      expect(() => new CompanyCode("得意先001")).toThrow(
        "取引先コードは英数字・ハイフン・アンダースコアのみ使用できます"
      );
    });

    it("スペースを含むコードを拒否する", () => {
      expect(() => new CompanyCode("CUST 001")).toThrow(ValidationError);
      expect(() => new CompanyCode("CUST 001")).toThrow(
        "取引先コードは英数字・ハイフン・アンダースコアのみ使用できます"
      );
    });

    it("特殊文字を拒否する", () => {
      expect(() => new CompanyCode("CUST@001")).toThrow(ValidationError);
      expect(() => new CompanyCode("CUST@001")).toThrow(
        "取引先コードは英数字・ハイフン・アンダースコアのみ使用できます"
      );
    });
  });

  describe("equals", () => {
    it("同じ値は等しい", () => {
      const a = new CompanyCode("CUST001");
      const b = new CompanyCode("CUST001");
      expect(a.equals(b)).toBe(true);
    });

    it("異なる値は等しくない", () => {
      const a = new CompanyCode("CUST001");
      const b = new CompanyCode("CUST002");
      expect(a.equals(b)).toBe(false);
    });
  });
});
