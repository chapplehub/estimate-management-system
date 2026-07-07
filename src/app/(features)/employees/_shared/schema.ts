import { USER_ROLES } from "@server/shared/auth/types";
import { z } from "zod";

/**
 * 従業員フォームの基盤スキーマ
 * 作成・編集で共通のフィールド（name, email, role）
 */
export const employeeBaseSchema = z.object({
  name: z
    .string({ error: "必須入力です" })
    .trim()
    .min(1, { error: "名前を入力してください" })
    .max(100, { error: "名前は100文字以内で入力してください" }),
  email: z
    .string({ error: "必須入力です" })
    .trim()
    .max(254, { error: "メールアドレスは254文字以内で入力してください" })
    .pipe(z.email({ error: "有効なメールアドレスを入力してください" })),
  // User.roleに設定される値（"admin" | "user"）
  role: z.enum([USER_ROLES.ADMIN, USER_ROLES.USER], {
    error: "権限を選択してください",
  }),
  // 担当役割ID（任意）。空選択＝解除で BE の「未指定＝解除」意味論と一致する。
  // conform が空文字を undefined 化するため .optional() が必須（[[conform-empty-string-to-undefined]]）。
  // 存在検証はセレクトの選択肢が制約し、改竄は BE の new RoleId() が弾く（departmentId と同方針）。
  roleId: z.string().optional(),
});

/**
 * 従業員コードのスキーマ（作成時のみ使用）
 */
export const employeeCdSchema = z
  .string({ error: "必須入力です" })
  .trim()
  .regex(/^EMP\d{6}$/, {
    error: "従業員コードはEMP + 6桁の数字で入力してください",
  })
  .refine(
    (val) => parseInt(val.substring(3), 10) >= 1,
    "従業員コードは EMP000001 以上である必要があります"
  );

/**
 * パスワードのスキーマ（作成時のみ使用）
 */
export const passwordSchema = z
  .string({ error: "必須入力です" })
  .min(8, { error: "パスワードは8文字以上で入力してください" })
  .max(100, { error: "パスワードは100文字以内で入力してください" });

export type EmployeeBaseInput = z.infer<typeof employeeBaseSchema>;
