import { z } from "zod";

/**
 * 商品コードのスキーマ（英数字のみ、1-50桁、自動大文字変換）
 */
export const productCodeSchema = z
  .string({ error: "必須入力です" })
  .trim()
  .toUpperCase()
  .min(1, { error: "商品コードを入力してください" })
  .max(50, { error: "商品コードは50文字以内で入力してください" })
  .regex(/^[A-Z0-9]+$/, {
    error: "商品コードは英数字のみで入力してください",
  });

/**
 * 商品区分のスキーマ
 */
export const productCategorySchema = z.enum(["INDIVIDUAL", "CONSUMABLE", "SET"], {
  error: "商品区分を選択してください",
});

/**
 * 商品単位のスキーマ
 */
export const productUnitSchema = z.enum(["UNIT", "PIECE", "ROLL", "BOX", "SHEET", "SET"], {
  error: "単位を選択してください",
});

/**
 * 商品フォームの基盤スキーマ
 * 作成・編集で共通のフィールド
 */
export const productBaseSchema = z.object({
  name: z
    .string({ error: "必須入力です" })
    .trim()
    .min(1, { error: "商品名を入力してください" })
    .max(100, { error: "商品名は100文字以内で入力してください" }),
  unit: productUnitSchema,
  description: z
    .string()
    .trim()
    .max(1000, { error: "商品説明は1000文字以内で入力してください" })
    .optional()
    .transform((val) => val || null),
  note: z
    .string()
    .trim()
    .max(1000, { error: "備考は1000文字以内で入力してください" })
    .optional()
    .transform((val) => val || null),
  costPrice: z
    .string()
    .trim()
    .optional()
    .transform((val) => {
      if (!val || val === "") return null;
      return Number(val);
    })
    .pipe(
      z
        .number({ error: "原価は数値で入力してください" })
        .min(0, { error: "原価は0以上で入力してください" })
        .nullable()
    ),
});

export type ProductBaseInput = z.infer<typeof productBaseSchema>;
