import { z } from "zod";

/**
 * 従業員作成フォームのバリデーションスキーマ
 */
export const createEmployeeSchema = z.object({
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
  employeeCd: z
    .string({ error: "必須入力です" })
    .trim()
    .regex(/^EMP\d{6}$/, {
      error: "従業員コードはEMP + 6桁の数字で入力してください",
    })
    .refine(
      (val) => parseInt(val.substring(3), 10) >= 1,
      "従業員コードは EMP000001 以上である必要があります"
    ),
  password: z
    .string({ error: "必須入力です" })
    .min(8, { error: "パスワードは8文字以上で入力してください" })
    .max(100, { error: "パスワードは100文字以内で入力してください" }),
  role: z.enum(["ADMIN", "USER"], {
    error: "権限を選択してください",
  }),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
