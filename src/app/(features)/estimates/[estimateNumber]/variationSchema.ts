import { z } from "zod";

/**
 * バリ内容編集フォーム（S4 / C4）のバリデーションスキーマ。
 *
 * 動的な明細配列は単一の hidden field に JSON で載せて往復する（ADR-0050）。本スキーマは
 * その文字列を `transform(JSON.parse).pipe(z.array(...))` で検証する。version・全体値引・
 * メモ等のスカラー項目は FormData の文字列を coerce する（S3 ヘッダー編集と同型）。
 * 数値の最終ガードはドメイン VO（Quantity / DiscountRate / Money）が担う二重防御の外側。
 * sortOrder は「配列順 = 真実」（ADR-0050）のため JSON には載せず Server Action で index 導出。
 */

/** 明細1件（JSON 配列の要素）。商品名・単位は選択時スナップショット（§8・編集不可）。 */
const lineSchema = z.object({
  productId: z.string().min(1, "商品を選択してください"),
  itemName: z.string().min(1, "商品名が空です"),
  unit: z.string().min(1, "単位が空です"),
  // 数量: 1 以上の整数（Quantity VO と整合）。
  quantity: z.number().int("数量は整数で入力してください").min(1, "数量は1以上で入力してください"),
  // 単価: 円・0 以上（販売単価マスタ未確定のため新規行は 0＝要入力）。
  unitPrice: z.number().min(0, "単価は0以上で入力してください"),
  // 掛率: 0 超〜9.9999（DiscountRate VO と整合）。1.0 が値引なし。
  discountRate: z
    .number()
    .gt(0, "掛率は0より大きい値で入力してください")
    .max(9.9999, "掛率は9.9999以下で入力してください"),
  // 明細値引: 円・0 以上。
  itemDiscount: z.number().min(0, "明細値引は0以上で入力してください"),
  // メモは optional: conform の parseWithZod は空フィールドを undefined に変換するため
  // z.string() だと空メモが「expected string, received undefined」で失敗する。空＝未入力＝
  // ドメインの Null Object（ADR-0034）に対応するので optional が正しい。required に戻さないこと。
  customerMemo: z.string().optional(),
  internalMemo: z.string().optional(),
});

export type VariationLineInput = z.infer<typeof lineSchema>;

/** 明細配列フィールド: JSON 文字列をパースして配列スキーマへ pipe する（ADR-0050）。空配列を許可。 */
const linesField = z
  .string()
  .transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "明細データが不正です" });
      return z.NEVER;
    }
  })
  .pipe(z.array(lineSchema));

export const updateVariationContentSchema = z.object({
  /** 楽観ロックトークン（ADR-0039・集約ルート）。hidden で往復。 */
  version: z.coerce.number().int(),
  /** 編集対象バリエーション。estimateId は estimateNumber から DTO 解決する。 */
  variationId: z.string().min(1, "バリエーションが特定できません"),
  overallDiscount: z.coerce.number().min(0, "全体値引は0以上で入力してください"),
  // メモは optional（conform は空フィールドを undefined 化する・上の lineSchema 同様）。
  customerMemo: z.string().optional(),
  internalMemo: z.string().optional(),
  lines: linesField,
});

export type UpdateVariationContentFormInput = z.infer<typeof updateVariationContentSchema>;
