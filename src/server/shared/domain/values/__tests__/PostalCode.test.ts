import { describe, expect, it } from "vitest";
import { PostalCode } from "../PostalCode";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("PostalCode", () => {
  describe("正常系", () => {
    it("7桁の数字を受け入れる", () => {
      const code = new PostalCode("1234567");
      expect(code.value).toBe("1234567");
    });

    it("ハイフン付きを受け入れてハイフンなしに正規化する", () => {
      const code = new PostalCode("123-4567");
      expect(code.value).toBe("1234567");
    });

    it("formattedでハイフン付きを返す", () => {
      const code = new PostalCode("1234567");
      expect(code.formatted).toBe("123-4567");
    });
  });

  describe("異常系", () => {
    it("6桁を拒否する", () => {
      expect(() => new PostalCode("123456")).toThrow(ValidationError);
    });

    it("8桁を拒否する", () => {
      expect(() => new PostalCode("12345678")).toThrow(ValidationError);
    });

    it("英字を含む場合を拒否する", () => {
      expect(() => new PostalCode("123456A")).toThrow(ValidationError);
    });

    it("空文字を拒否する", () => {
      expect(() => new PostalCode("")).toThrow(ValidationError);
    });
  });

  describe("equals", () => {
    it("同じ郵便番号は等しい", () => {
      const a = new PostalCode("1234567");
      const b = new PostalCode("123-4567");
      expect(a.equals(b)).toBe(true);
    });
  });
});
