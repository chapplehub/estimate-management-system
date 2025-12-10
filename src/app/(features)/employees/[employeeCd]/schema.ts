import { z } from "zod";

/**
 * 従業員更新フォームのバリデーションスキーマ
 */
export const updateEmployeeSchema = z.object({
  id: z.string().min(1, "IDが不正です"),
  name: z
    .string()
    .min(1, "名前を入力してください")
    .max(100, "名前は100文字以内で入力してください"),
  email: z.email("有効なメールアドレスを入力してください"),
  employeeCd: z
    .string()
    .regex(/^EMP\d{6}$/, "従業員コードはEMP + 6桁の数字で入力してください"),
  role: z.enum(["ADMIN", "USER"], {
    message: "権限を選択してください",
  }),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
