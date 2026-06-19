import { z } from "zod";

/**
 * 改訂先バリエーションの部分編集フォーム（#390）のバリデーションスキーマ。
 *
 * 改訂先は商品・数量・改訂価格・行構成が固定（ADR-0060）で、編集可能集合は
 * 「単価・掛率・明細値引・全体値引・メモ（バリ＋明細）」のみ。動的な明細調整配列は単一の
 * hidden field に JSON で載せて往復する（ADR-0050・C4 の nodes / メモの itemMemos と同契約）。
 * version・全体値引・バリメモはスカラー。空メモは Memo.empty() に正規化される（ADR-0034）ため
 * メモは optional（conform は空フィールドを undefined 化するため required だと空メモが弾かれる）。
 */

/** 明細調整1件（JSON 配列の要素）。itemId で対象明細を特定する。数量・商品は持たない。 */
const adjustItemSchema = z.object({
  itemId: z.string().min(1, "明細が特定できません"),
  /** 単価（円・整数・0以上）。 */
  unitPrice: z.number().int("単価は整数で指定してください").min(0, "単価は0以上で指定してください"),
  /** 掛率（>0。例 1.0=値引なし）。上限は DiscountRate VO（9.9999）が最終強制。 */
  discountRate: z.number().positive("掛率は0より大きい値で指定してください"),
  /** 明細値引（円・整数・0以上）。 */
  itemDiscount: z
    .number()
    .int("明細値引は整数で指定してください")
    .min(0, "明細値引は0以上で指定してください"),
  customerMemo: z.string().optional(),
  internalMemo: z.string().optional(),
});

export type AdjustItemFormInput = z.infer<typeof adjustItemSchema>;

/**
 * 明細調整配列フィールド: JSON 文字列をパースして配列へ pipe する（ADR-0050）。空配列許可
 * （明細ゼロのバリも理論上ありうるため）。
 */
export const adjustItemsField = z
  .string()
  .transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "明細調整データが不正です" });
      return z.NEVER;
    }
  })
  .pipe(z.array(adjustItemSchema));

/**
 * 改訂先の部分編集スキーマ（#390）。version は集約ルートの楽観ロックトークン（ADR-0039）、
 * variationId で対象バリを特定（estimateId は estimateNumber から DTO 解決）。
 */
export const updateVariationAdjustmentSchema = z.object({
  /** 楽観ロックトークン（ADR-0039・集約ルート）。hidden で往復。 */
  version: z.coerce.number().int(),
  /** 編集対象バリエーション。 */
  variationId: z.string().min(1, "バリエーションが特定できません"),
  /** 全体値引（円・整数・0以上）。 */
  overallDiscount: z.coerce
    .number()
    .int("全体値引は整数で指定してください")
    .min(0, "全体値引は0以上で指定してください"),
  /** バリ単位の顧客/社内メモ（スカラー）。 */
  customerMemo: z.string().optional(),
  internalMemo: z.string().optional(),
  /** 明細単位の調整（JSON hidden・itemId キーのフラット配列）。 */
  items: adjustItemsField,
});

export type UpdateVariationAdjustmentFormInput = z.infer<typeof updateVariationAdjustmentSchema>;
