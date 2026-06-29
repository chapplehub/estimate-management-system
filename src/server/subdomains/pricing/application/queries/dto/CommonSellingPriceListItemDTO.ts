/**
 * 一覧の単価状態（参照日＝今日 を基準にした商品ごとの単価設定状況・#473 で三状態化）。
 *
 * - `active`: 参照日を覆う期間行がある（現在有効単価あり）
 * - `lapsed`: 期間行は存在するが参照日を覆う行が無い（将来のみ／失効のみ＝失効中）
 * - `unset`: 期間行が1件も無い（共通売単価が未設定）
 *
 * `currentSellingPrice` の null だけでは `lapsed`/`unset` を判別できないため、業務要件として三状態を
 * BE が直接返す。これは ADR-20260627-86b の「未設定の内訳は持たず null に畳む」判断を更新（supersede）する。
 */
export type CommonSellingPricePriceStatus = "active" | "lapsed" | "unset";

/**
 * 共通売単価 保守一覧の1行 DTO（read 関心・#429 保守画面の母集合=全商品）。
 *
 * 商品マスタ1件につき1行。`currentSellingPrice` は参照日（今日）に有効な共通売単価を「値 or null」の
 * 2値で持つ（未設定・将来のみ・失効のみは一様に null）。`priceStatus` で null の内訳（失効中／未設定）を
 * 区別する（#473・三状態を業務要件として維持）。
 *
 * 価格は精度保持のため `::text` の10進文字列で運ぶ（消費側で `Money.fromDecimalString`）。ドメイン VO は
 * QueryService の境界を越えさせない（既存 QueryService 規約）。
 */
export interface CommonSellingPriceListItemDTO {
  productId: string;
  productCode: string;
  productName: string;
  /** 商品マスタの有効フラグ（無効商品も母集合に含めるため UI 側のバッジ判定に渡す）。 */
  isActive: boolean;
  /** 参照日に有効な共通売単価の10進文字列。今日有効な行が無ければ null（`priceStatus` で内訳判別）。 */
  currentSellingPrice: string | null;
  /** 単価設定状況（active／lapsed／unset）。null の `currentSellingPrice` の内訳を区別する。 */
  priceStatus: CommonSellingPricePriceStatus;
}
