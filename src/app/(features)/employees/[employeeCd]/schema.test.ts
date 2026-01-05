import { describe, expect, it } from "vitest";
import { z } from "zod";
import { updateEmployeeSchema } from "./schema";
import { USER_ROLES } from "@server/shared/auth/types";

/**
 * updateEmployeeSchema のバリデーションテスト
 *
 * このテストはプレゼンテーション層のフォーム入力バリデーションを検証します。
 * 編集フォームでは name, email, role のみをバリデーション対象とします。
 * id, employeeCd はURLパラメータから取得するためスキーマに含まれません。
 */

// ヘルパー: 有効な基本データ
const validInput = {
  name: "山田太郎",
  email: "yamada@example.com",
  role: USER_ROLES.USER,
};

describe("updateEmployeeSchema", () => {
  describe("正常系", () => {
    it("全フィールドが有効な値の場合、パースが成功する", () => {
      const result = updateEmployeeSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validInput);
      }
    });

    it("roleがadminの場合もパースが成功する", () => {
      const input = { ...validInput, role: USER_ROLES.ADMIN };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("必須入力", () => {
    it("nameがundefinedの場合エラー", () => {
      const { name: _, ...inputWithoutName } = validInput;
      const result = updateEmployeeSchema.safeParse(inputWithoutName);
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.name?.[0]).toBe("必須入力です");
      }
    });

    it("emailがundefinedの場合エラー", () => {
      const { email: _, ...inputWithoutEmail } = validInput;
      const result = updateEmployeeSchema.safeParse(inputWithoutEmail);
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.email?.[0]).toBe("必須入力です");
      }
    });

    it("roleがundefinedの場合エラー", () => {
      const { role: _, ...inputWithoutRole } = validInput;
      const result = updateEmployeeSchema.safeParse(inputWithoutRole);
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.role?.[0]).toBe("権限を選択してください");
      }
    });
  });

  describe("name バリデーション", () => {
    it("空文字の場合エラー", () => {
      const input = { ...validInput, name: "" };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.name?.[0]).toBe("名前を入力してください");
      }
    });

    it("空白のみの場合エラー（trimされて空文字になる）", () => {
      const input = { ...validInput, name: "   " };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.name?.[0]).toBe("名前を入力してください");
      }
    });

    it("100文字の場合は成功", () => {
      const input = { ...validInput, name: "あ".repeat(100) };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("101文字の場合エラー", () => {
      const input = { ...validInput, name: "あ".repeat(101) };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.name?.[0]).toBe("名前は100文字以内で入力してください");
      }
    });

    it("前後の空白がトリムされる", () => {
      const input = { ...validInput, name: "  山田太郎  " };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("山田太郎");
      }
    });
  });

  describe("email バリデーション", () => {
    it("空文字の場合エラー", () => {
      const input = { ...validInput, email: "" };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("不正な形式の場合エラー", () => {
      const input = { ...validInput, email: "invalid-email" };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.email?.[0]).toBe("有効なメールアドレスを入力してください");
      }
    });

    it("@がない場合エラー", () => {
      const input = { ...validInput, email: "yamadaexample.com" };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("254文字のメールアドレスは成功", () => {
      // local part (64) + @ (1) + domain (189) = 254
      const localPart = "a".repeat(64);
      const domain = "b".repeat(185) + ".com";
      const input = { ...validInput, email: `${localPart}@${domain}` };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("255文字以上のメールアドレスはエラー", () => {
      const localPart = "a".repeat(64);
      const domain = "b".repeat(186) + ".com";
      const input = { ...validInput, email: `${localPart}@${domain}` };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.email?.[0]).toBe(
          "メールアドレスは254文字以内で入力してください"
        );
      }
    });

    it("前後の空白がトリムされる", () => {
      const input = { ...validInput, email: "  yamada@example.com  " };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("yamada@example.com");
      }
    });
  });

  describe("role バリデーション", () => {
    it("userは有効", () => {
      const input = { ...validInput, role: USER_ROLES.USER };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("adminは有効", () => {
      const input = { ...validInput, role: USER_ROLES.ADMIN };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("無効な値の場合エラー", () => {
      const input = { ...validInput, role: "INVALID" };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const { fieldErrors } = z.flattenError(result.error);
        expect(fieldErrors.role?.[0]).toBe("権限を選択してください");
      }
    });

    it("空文字の場合エラー", () => {
      const input = { ...validInput, role: "" };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("スキーマの構造", () => {
    it("id, employeeCd, password フィールドは含まれない", () => {
      // 編集スキーマには id, employeeCd, password は含まれない
      // これらはURLパラメータから取得するか、編集時には不要
      const input = {
        ...validInput,
        id: "some-id",
        employeeCd: "EMP000001",
        password: "password123",
      };
      const result = updateEmployeeSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        // 余分なフィールドはstripされる（Zodのデフォルト動作）
        expect(result.data).toEqual(validInput);
        expect("id" in result.data).toBe(false);
        expect("employeeCd" in result.data).toBe(false);
        expect("password" in result.data).toBe(false);
      }
    });
  });
});
