import { PREFECTURES } from "@server/shared/domain/values/Prefecture";
import { z } from "zod";

/**
 * 得意先フォームの基盤スキーマ
 * 作成・編集で共通のフィールド（name, postalCode, prefecture, address, phoneNumber, faxNumber, contactPerson, marginRate）
 */
export const customerBaseSchema = z.object({
  name: z
    .string({ error: "必須入力です" })
    .trim()
    .min(1, { error: "名前を入力してください" })
    .max(100, { error: "名前は100文字以内で入力してください" }),
  postalCode: z
    .string()
    .trim()
    .transform((val) => val.replace(/-/g, ""))
    .pipe(
      z.union([
        z.literal(""),
        z.string().regex(/^\d{7}$/, {
          error: "郵便番号は7桁の数字で入力してください（例: 1234567）",
        }),
      ])
    )
    .optional(),
  prefecture: z
    .string()
    .refine((val) => val === "" || PREFECTURES.includes(val as (typeof PREFECTURES)[number]), {
      message: "有効な都道府県名を選択してください",
    })
    .optional(),
  address: z.string().trim().max(200, { error: "住所は200文字以内で入力してください" }).optional(),
  phoneNumber: z
    .string()
    .trim()
    .transform((val) => val.replace(/-/g, ""))
    .pipe(
      z.union([
        z.literal(""),
        z.string().regex(/^\d{10,11}$/, {
          error: "電話番号は10〜11桁の数字で入力してください",
        }),
      ])
    )
    .optional(),
  faxNumber: z
    .string()
    .trim()
    .transform((val) => val.replace(/-/g, ""))
    .pipe(
      z.union([
        z.literal(""),
        z.string().regex(/^\d{10,11}$/, {
          error: "FAX番号は10〜11桁の数字で入力してください",
        }),
      ])
    )
    .optional(),
  contactPerson: z.string().trim().optional(),
  marginRate: z
    .string()
    .trim()
    .optional()
    .transform((val) => {
      if (!val || val === "") return null;
      return Number(val);
    })
    .pipe(
      z
        .number({ error: "マージン率は数値で入力してください" })
        .min(0, { error: "マージン率は0〜100%の範囲で指定してください" })
        .max(100, { error: "マージン率は0〜100%の範囲で指定してください" })
        .nullable()
    ),
});

/**
 * 取引先コードのスキーマ（作成時のみ使用）
 */
export const customerCodeSchema = z
  .string({ error: "必須入力です" })
  .trim()
  .min(1, { error: "取引先コードを入力してください" })
  .max(20, { error: "取引先コードは20文字以内で入力してください" })
  .regex(/^[A-Za-z0-9\-_]+$/, {
    error: "取引先コードは英数字・ハイフン・アンダースコアのみ使用できます",
  });

export type CustomerBaseInput = z.infer<typeof customerBaseSchema>;
