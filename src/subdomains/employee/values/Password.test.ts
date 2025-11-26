import { ValidationError } from "@/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { Password } from "./Password";

describe("Password 値オブジェクト", () => {
  describe("正常系", () => {
    it("有効なパスワードでインスタンスを作成できる", () => {
      const password = new Password("ValidPass123!");
      expect(password.value).toBe("ValidPass123!");
    });

    it("最小長（10文字）のパスワードを作成できる", () => {
      const password = new Password("Abcd123!@#");
      expect(password.value).toBe("Abcd123!@#");
    });

    it("最大長（24文字）のパスワードを作成できる", () => {
      const password = new Password("Abcd123!@#Abcd123!@#AB");
      expect(password.value).toBe("Abcd123!@#Abcd123!@#AB");
    });

    it("パスワードは前後の空白が除去される", () => {
      const password = new Password("  ValidPass123!  ");
      expect(password.value).toBe("ValidPass123!");
    });

    it("パスワードは大文字小文字が保持される", () => {
      const password = new Password("ValidPass123!");
      expect(password.value).toBe("ValidPass123!");
      expect(password.value).not.toBe("validpass123!");
    });

    it("同じパスワードは等価である", () => {
      const password1 = new Password("ValidPass123!");
      const password2 = new Password("ValidPass123!");
      expect(password1.equals(password2)).toBe(true);
    });

    it("異なるパスワードは等価でない", () => {
      const password1 = new Password("ValidPass123!");
      const password2 = new Password("DifferentPass456!");
      expect(password1.equals(password2)).toBe(false);
    });

    it("すべての記号を含むパスワードを作成できる", () => {
      const password = new Password("Abc123!@#$%^&*()");
      expect(password.value).toBe("Abc123!@#$%^&*()");
    });
  });

  describe("異常系 - 長さ", () => {
    it("空文字列の場合はエラー", () => {
      expect(() => new Password("")).toThrow(ValidationError);
      expect(() => new Password("")).toThrow("パスワードは10文字以上である必要があります");
    });

    it("短すぎる（9文字）場合はエラー", () => {
      expect(() => new Password("Abc123!@#")).toThrow(ValidationError);
      expect(() => new Password("Abc123!@#")).toThrow("パスワードは10文字以上である必要があります");
    });

    it("長すぎる（25文字）場合はエラー", () => {
      expect(() => new Password("Abcd123!@#Abcd123!@#ABCDE")).toThrow(ValidationError);
      expect(() => new Password("Abcd123!@#Abcd123!@#ABCDE")).toThrow("パスワードは24文字以下である必要があります");
    });
  });

  describe("異常系 - 文字種類", () => {
    it("小文字がない場合はエラー", () => {
      expect(() => new Password("ABCD123!@#")).toThrow(ValidationError);
      expect(() => new Password("ABCD123!@#")).toThrow(
        "パスワードは小文字、大文字、数字、記号を含む必要があります"
      );
    });

    it("大文字がない場合はエラー", () => {
      expect(() => new Password("abcd123!@#")).toThrow(ValidationError);
      expect(() => new Password("abcd123!@#")).toThrow(
        "パスワードは小文字、大文字、数字、記号を含む必要があります"
      );
    });

    it("数字がない場合はエラー", () => {
      expect(() => new Password("Abcdefgh!@#")).toThrow(ValidationError);
      expect(() => new Password("Abcdefgh!@#")).toThrow(
        "パスワードは小文字、大文字、数字、記号を含む必要があります"
      );
    });

    it("記号がない場合はエラー", () => {
      expect(() => new Password("Abcd123456")).toThrow(ValidationError);
      expect(() => new Password("Abcd123456")).toThrow(
        "パスワードは小文字、大文字、数字、記号を含む必要があります"
      );
    });

    it("許可されていない文字が含まれる場合はエラー", () => {
      expect(() => new Password("ValidPass123!あ")).toThrow(ValidationError);
      expect(() => new Password("ValidPass123!あ")).toThrow(
        "パスワードは小文字、大文字、数字、記号を含む必要があります"
      );
    });

    it("スペースのみの場合はエラー", () => {
      expect(() => new Password("          ")).toThrow(ValidationError);
    });
  });

  describe("境界値テスト", () => {
    it("ちょうど10文字のパスワードは有効", () => {
      const password = new Password("Abcd123!@#");
      expect(password.value).toBe("Abcd123!@#");
    });

    it("ちょうど24文字のパスワードは有効", () => {
      const password = new Password("Abcd123!@#Abcd123!@#AB");
      expect(password.value).toBe("Abcd123!@#Abcd123!@#AB");
    });

    it("各文字種類が1つずつのパスワードは有効", () => {
      const password = new Password("Aa1!bcdefg");
      expect(password.value).toBe("Aa1!bcdefg");
    });
  });
});
