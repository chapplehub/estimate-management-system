import { ValidationError } from "@/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { MailAddress } from "./MailAddress";

describe("MailAddress 値オブジェクト", () => {
  describe("正常系", () => {
    it("有効なメールアドレスでインスタンスを作成できる", () => {
      const mailAddress = new MailAddress("tanaka@company.com");
      expect(mailAddress.value).toBe("tanaka@company.com");
    });

    it("メールアドレスは小文字に正規化される", () => {
      const mailAddress = new MailAddress("Tanaka@Company.COM");
      expect(mailAddress.value).toBe("tanaka@company.com");
    });

    it("同じメールアドレスは等価である", () => {
      const mailAddress1 = new MailAddress("tanaka@company.com");
      const mailAddress2 = new MailAddress("tanaka@company.com");
      expect(mailAddress1.equals(mailAddress2)).toBe(true);
    });

    it("異なるメールアドレスは等価でない", () => {
      const mailAddress1 = new MailAddress("tanaka@company.com");
      const mailAddress2 = new MailAddress("suzuki@company.com");
      expect(mailAddress1.equals(mailAddress2)).toBe(false);
    });
  });

  describe("異常系", () => {
    it("空文字列の場合はエラー", () => {
      expect(() => new MailAddress("")).toThrow(ValidationError);
      expect(() => new MailAddress("")).toThrow("メールアドレスは必須です");
    });

    it("不正な形式の場合はエラー", () => {
      expect(() => new MailAddress("invalid-mailAddress")).toThrow(
        ValidationError
      );
      expect(() => new MailAddress("invalid-mailAddress")).toThrow(
        "メールアドレスの形式が正しくありません"
      );
    });

    it("@がない場合はエラー", () => {
      expect(() => new MailAddress("tanaka.company.com")).toThrow(
        ValidationError
      );
    });

    it("ドメインがない場合はエラー", () => {
      expect(() => new MailAddress("tanaka@")).toThrow(ValidationError);
    });
  });
});
