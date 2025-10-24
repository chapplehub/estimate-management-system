import { ValidationError } from "@/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Email } from "../Email";

describe("Email 値オブジェクト", () => {
  describe("正常系", () => {
    it("有効なメールアドレスでインスタンスを作成できる", () => {
      const email = new Email("tanaka@company.com");
      expect(email.value).toBe("tanaka@company.com");
    });

    it("メールアドレスは小文字に正規化される", () => {
      const email = new Email("Tanaka@Company.COM");
      expect(email.value).toBe("tanaka@company.com");
    });

    it("同じメールアドレスは等価である", () => {
      const email1 = new Email("tanaka@company.com");
      const email2 = new Email("tanaka@company.com");
      expect(email1.equals(email2)).toBe(true);
    });

    it("異なるメールアドレスは等価でない", () => {
      const email1 = new Email("tanaka@company.com");
      const email2 = new Email("suzuki@company.com");
      expect(email1.equals(email2)).toBe(false);
    });
  });

  describe("異常系", () => {
    it("空文字列の場合はエラー", () => {
      expect(() => new Email("")).toThrow(ValidationError);
      expect(() => new Email("")).toThrow("メールアドレスは必須です");
    });

    it("不正な形式の場合はエラー", () => {
      expect(() => new Email("invalid-email")).toThrow(ValidationError);
      expect(() => new Email("invalid-email")).toThrow(
        "メールアドレスの形式が正しくありません"
      );
    });

    it("@がない場合はエラー", () => {
      expect(() => new Email("tanaka.company.com")).toThrow(ValidationError);
    });

    it("ドメインがない場合はエラー", () => {
      expect(() => new Email("tanaka@")).toThrow(ValidationError);
    });
  });
});
