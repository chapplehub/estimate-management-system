import { z } from "zod";

/**
 * 改訂元のメモのみ編集フォーム（C7・ADR-0059）のバリデーションスキーマ。
 *
 * 凍結された改訂元はメモ以外編集不可のため、本フォームは「バリ単位メモ＋各明細単位メモ」
 * だけを往復させる（明細・数量・価格は read-only）。動的な明細メモ配列は単一の hidden field に
 * JSON で載せて往復する（ADR-0050・C4 の nodes と同じ往復契約）。version・バリメモはスカラー。
 * 空メモは Memo.empty() に正規化される（ADR-0034）ため、すべて optional にする（conform は空
 * フィールドを undefined 化するため required だと空メモが弾かれる。required に戻さないこと）。
 */

/** 明細メモ1件（JSON 配列の要素）。itemId で対象明細を特定する。 */
const itemMemoSchema = z.object({
  itemId: z.string().min(1, "明細が特定できません"),
  customerMemo: z.string().optional(),
  internalMemo: z.string().optional(),
});

export type ItemMemoFormInput = z.infer<typeof itemMemoSchema>;

/**
 * 明細メモ配列フィールド: JSON 文字列をパースして配列へ pipe する（ADR-0050）。空配列許可
 * （メモ対象明細が無いバリも理論上ありうるため）。
 */
export const itemMemosField = z
  .string()
  .transform((s, ctx) => {
    try {
      return JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "明細メモデータが不正です" });
      return z.NEVER;
    }
  })
  .pipe(z.array(itemMemoSchema));

/**
 * メモのみ更新スキーマ（改訂元・ADR-0059）。version は集約ルートの楽観ロックトークン（ADR-0039）、
 * variationId で対象バリを特定（estimateId は estimateNumber から DTO 解決）。
 */
export const updateVariationMemosSchema = z.object({
  /** 楽観ロックトークン（ADR-0039・集約ルート）。hidden で往復。 */
  version: z.coerce.number().int(),
  /** 編集対象バリエーション。 */
  variationId: z.string().min(1, "バリエーションが特定できません"),
  /** バリ単位の顧客/社内メモ（スカラー）。 */
  customerMemo: z.string().optional(),
  internalMemo: z.string().optional(),
  /** 明細単位メモ（JSON hidden・itemId キーのフラット配列）。 */
  itemMemos: itemMemosField,
});

export type UpdateVariationMemosFormInput = z.infer<typeof updateVariationMemosSchema>;
