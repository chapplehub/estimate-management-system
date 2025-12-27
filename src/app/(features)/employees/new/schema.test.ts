import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createEmployeeSchema } from "./schema";

/**
 * createEmployeeSchema のバリデーションテスト
 *
 * このテストはプレゼンテーション層のフォーム入力バリデーションを検証します。
 * Domain層のValue Objectsはより厳格なビジネスルールを持つため、
 * ここでは入力形式の検証のみを行います。
 */

// ヘルパー: 有効な基本データ
const validInput = {
  name: "山田太郎",
  email: "yamada@example.com",
  employeeCd: "EMP000001",
  password: "password123",
  role: "USER" as const,
};

describe("createEmployeeSchema", () => {
  describe("正常系", () => {
    it("全フィールドが有効な値の場合、パースが成功する", () => {
      const result = createEmployeeSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });
  });

  describe("name フィールド", () => {
    describe("正常系", () => {
      it("1文字の名前が許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          name: "A",
        });
        expect(result.success).toBe(true);
      });

      it("100文字の名前が許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          name: "あ".repeat(100),
        });
        expect(result.success).toBe(true);
      });

      it("日本語の名前が許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          name: "山田太郎",
        });
        expect(result.success).toBe(true);
      });
    });

    describe("異常系", () => {
      it("空文字列はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          name: "",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.name?.[0]).toBe("名前を入力してください");
        }
      });

      it("101文字以上はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          name: "あ".repeat(101),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.name?.[0]).toBe(
            "名前は100文字以内で入力してください"
          );
        }
      });
    });
  });

  describe("email フィールド", () => {
    describe("正常系", () => {
      it("有効なメールアドレスが許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          email: "test@example.com",
        });
        expect(result.success).toBe(true);
      });

      it("サブドメイン付きメールが許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          email: "user@sub.example.com",
        });
        expect(result.success).toBe(true);
      });
    });

    describe("異常系", () => {
      it("空文字列はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          email: "",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.email?.[0]).toBe(
            "有効なメールアドレスを入力してください"
          );
        }
      });

      it("@がないとエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          email: "invalid",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.email?.[0]).toBe(
            "有効なメールアドレスを入力してください"
          );
        }
      });

      it("ドメインがないとエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          email: "user@",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.email?.[0]).toBe(
            "有効なメールアドレスを入力してください"
          );
        }
      });
    });
  });

  describe("employeeCd フィールド", () => {
    describe("正常系", () => {
      it("EMP + 6桁の数字が許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          employeeCd: "EMP000001",
        });
        expect(result.success).toBe(true);
      });

      it("EMP999999が許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          employeeCd: "EMP999999",
        });
        expect(result.success).toBe(true);
      });
    });

    describe("異常系", () => {
      it("空文字列はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          employeeCd: "",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.employeeCd?.[0]).toBe(
            "従業員コードはEMP + 6桁の数字で入力してください"
          );
        }
      });

      it("EMPで始まらないとエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          employeeCd: "ABC000001",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.employeeCd?.[0]).toBe(
            "従業員コードはEMP + 6桁の数字で入力してください"
          );
        }
      });

      it("5桁の数字はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          employeeCd: "EMP00001",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.employeeCd?.[0]).toBe(
            "従業員コードはEMP + 6桁の数字で入力してください"
          );
        }
      });

      it("7桁の数字はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          employeeCd: "EMP0000001",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.employeeCd?.[0]).toBe(
            "従業員コードはEMP + 6桁の数字で入力してください"
          );
        }
      });

      it("数字以外が含まれるとエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          employeeCd: "EMP00000A",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.employeeCd?.[0]).toBe(
            "従業員コードはEMP + 6桁の数字で入力してください"
          );
        }
      });

      it("小文字empはエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          employeeCd: "emp000001",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.employeeCd?.[0]).toBe(
            "従業員コードはEMP + 6桁の数字で入力してください"
          );
        }
      });
    });
  });

  describe("password フィールド", () => {
    describe("正常系", () => {
      it("8文字のパスワードが許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          password: "password",
        });
        expect(result.success).toBe(true);
      });

      it("100文字のパスワードが許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          password: "a".repeat(100),
        });
        expect(result.success).toBe(true);
      });
    });

    describe("異常系", () => {
      it("空文字列はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          password: "",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.password?.[0]).toBe(
            "パスワードは8文字以上で入力してください"
          );
        }
      });

      it("7文字はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          password: "pass123",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.password?.[0]).toBe(
            "パスワードは8文字以上で入力してください"
          );
        }
      });

      it("101文字以上はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          password: "a".repeat(101),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.password?.[0]).toBe(
            "パスワードは100文字以内で入力してください"
          );
        }
      });
    });
  });

  describe("role フィールド", () => {
    describe("正常系", () => {
      it("ADMINが許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          role: "ADMIN",
        });
        expect(result.success).toBe(true);
      });

      it("USERが許可される", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          role: "USER",
        });
        expect(result.success).toBe(true);
      });
    });

    describe("異常系", () => {
      it("空文字列はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          role: "",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.role?.[0]).toBe("権限を選択してください");
        }
      });

      it("未定義の値はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          role: "GUEST",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.role?.[0]).toBe("権限を選択してください");
        }
      });

      it("小文字はエラー", () => {
        const result = createEmployeeSchema.safeParse({
          ...validInput,
          role: "admin",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const { fieldErrors } = z.flattenError(result.error);
          expect(fieldErrors.role?.[0]).toBe("権限を選択してください");
        }
      });
    });
  });
});
