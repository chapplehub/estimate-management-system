import { z } from "zod";

/**
 * 従業員作成フォームのバリデーションスキーマ
 */
export const createEmployeeSchema = z.object({
  name: z
    .string()
    .min(1, "名前を入力してください")
    .max(100, "名前は100文字以内で入力してください"),
  email: z.email("有効なメールアドレスを入力してください"),
  employeeCd: z
    .string()
    .regex(/^EMP\d{6}$/, "従業員コードはEMP + 6桁の数字で入力してください"),
  password: z
    .string()
    .min(8, "パスワードは8文字以上で入力してください")
    .max(100, "パスワードは100文字以内で入力してください"),
  role: z.enum(["ADMIN", "USER"], {
    message: "権限を選択してください",
  }),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
