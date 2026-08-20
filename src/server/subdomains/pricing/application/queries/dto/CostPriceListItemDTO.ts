/**
 * 一覧の単価状態（参照日＝今日 を基準にした商品ごとの原価設定状況）。
 *
 * - `active`: 参照日を覆う期間行がある（現在有効原価あり）
 * - `lapsed`: 期間行は存在するが参照日を覆う行が無い（将来のみ／失効のみ＝失効中）
 * - `unset`: 期間行が1件も無い（原価が未設定）
 *
 * `currentCostPrice` の null だけでは `lapsed`/`unset` を判別できないため、業務要件として三状態を
 * BE が直接返す。共通売単価の同型ミラー（ADR-20260627-a5c・型は集約ごとに複製し共有しない）。
 */
export type CostPricePriceStatus = "active" | "lapsed" | "unset";

/**
 * 原価 保守一覧の1行 DTO（read 関心・#500 保守画面の母集合=全商品）。
 *
 * 商品マスタ1件につき1行。`currentCostPrice` は参照日（今日）に有効な原価を「値 or null」の
 * 2値で持つ（未設定・将来のみ・失効のみは一様に null）。`priceStatus` で null の内訳（失効中／未設定）を
 * 区別する（三状態・共通売単価 #473 と同構成）。
 *
 * 価格は精度保持のため `::text` の10進文字列で運ぶ（消費側で `Money.fromDecimalString`）。ドメイン VO は
 * QueryService の境界を越えさせない（既存 QueryService 規約）。
 */
export interface CostPriceListItemDTO {
  productId: string;
  productCode: string;
  productName: string;
  /** 商品マスタの有効フラグ（無効商品も母集合に含めるため UI 側のバッジ判定に渡す）。 */
  isActive: boolean;
  /** 参照日に有効な原価の10進文字列。今日有効な行が無ければ null（`priceStatus` で内訳判別）。 */
  currentCostPrice: string | null;
  /** 単価設定状況（active／lapsed／unset）。null の `currentCostPrice` の内訳を区別する。 */
  priceStatus: CostPricePriceStatus;
  /**
   * 現在有効行の適用開始日（`"YYYY-MM-DD"`）。有効行が無い（lapsed／unset）なら null。
   * `null` ＝有効行なし／`start` あり・`end` null ＝無期限、の2フィールドで多義を捌く（#501）。
   */
  currentPeriodStart: string | null;
  /**
   * 現在有効行の適用終了日（半開区間の排他上端の生値・`"YYYY-MM-DD"`）。無期限または有効行なしなら null
   * （編集 DTO の `end: null`＝無期限と同一意味論。包含端への変換は一覧では行わない）。
   */
  currentPeriodEnd: string | null;
}
