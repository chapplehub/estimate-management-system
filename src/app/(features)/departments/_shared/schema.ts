import { z } from "zod";

/**
 * 部署フォームの基盤スキーマ
 * 作成・編集で共通のフィールド（name, abbreviation, displayOrder, parentId）
 */
export const departmentBaseSchema = z.object({
  name: z
    .string({ error: "必須入力です" })
    .trim()
    .min(1, { error: "部署名を入力してください" })
    .max(100, { error: "部署名は100文字以内で入力してください" }),
  abbreviation: z
    .string({ error: "必須入力です" })
    .trim()
    .min(1, { error: "略称を入力してください" })
    .max(20, { error: "略称は20文字以内で入力してください" }),
  displayOrder: z.coerce
    .number({ error: "数値を入力してください" })
    .int({ error: "整数を入力してください" })
    .min(0, { error: "表示順は0以上で入力してください" }),
  parentId: z
    .string()
    .optional()
    .transform((val) => (val === "" ? undefined : val)),
});

/**
 * 部署コードのスキーマ（作成時のみ使用）
 */
export const departmentCdSchema = z
  .string({ error: "必須入力です" })
  .trim()
  .regex(/^DEPT\d{3}$/, {
    error: "部署コードはDEPT + 3桁の数字で入力してください",
  })
  .refine(
    (val) => parseInt(val.substring(4), 10) >= 1,
    "部署コードは DEPT001 以上である必要があります"
  );
