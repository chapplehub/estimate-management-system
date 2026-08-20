import { z } from "zod";

/**
 * 役割フォームの基盤スキーマ
 * 作成・編集で共通のフィールド（name, superiorRoleId）
 */
export const roleBaseSchema = z.object({
  name: z
    .string({ error: "必須入力です" })
    .trim()
    .min(1, { error: "役割名を入力してください" })
    .max(100, { error: "役割名は100文字以内で入力してください" }),
  superiorRoleId: z
    .string()
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
});

/**
 * 役割コードのスキーマ（作成時のみ使用）
 */
export const roleCdSchema = z
  .string({ error: "必須入力です" })
  .trim()
  .regex(/^ROLE\d{3}$/i, {
    error: "役割コードはROLE + 3桁の数字で入力してください",
  })
  .refine(
    (val) => parseInt(val.substring(4), 10) >= 1,
    "役割コードは ROLE001 以上である必要があります"
  );
