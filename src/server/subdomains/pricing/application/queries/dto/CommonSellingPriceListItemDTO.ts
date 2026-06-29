/**
 * 共通売単価 保守一覧の1行 DTO（read 関心・#429 保守画面の母集合=全商品）。
 *
 * 商品マスタ1件につき1行。`currentSellingPrice` は参照日（今日）に有効な共通売単価を「値 or null」の
 * 2値で持つ（未設定・将来のみ・失効のみは一様に null）。未設定の内訳は持たず、null=「今日有効な単価
 * 無し」として UI が可視化する（ADR-20260627-86b）。
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
  /** 参照日に有効な共通売単価の10進文字列。今日有効な行が無ければ null（未設定の可視化）。 */
  currentSellingPrice: string | null;
}
