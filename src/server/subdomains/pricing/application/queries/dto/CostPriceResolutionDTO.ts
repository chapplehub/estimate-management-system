/**
 * 原価の時点解決結果 DTO。
 *
 * ある暦日に有効な原価を1件返す read 関心の結果（ADR-0066・20260627-a5c）。売単価の
 * {@link SellingPriceResolutionDTO} と同型だが、原価は売単価と別概念・別列（cost_price）で
 * 粗利＝売単価 − 原価の被減数として消費されるため、層名でなく値の意味で型を分ける。
 *
 * `costPrice` は精度保持のため `::text` で取り出した10進文字列で運ぶ。消費側（粗利接続）が
 * `Money.fromDecimalString` で包んで使う前提で、float64 を一切通さない（pricing Mapper と同じ厳密変換の
 * 規律）。ドメイン VO（Money/CostUnitPrice）は QueryService の境界を越えさせない。
 */
export interface CostPriceResolutionDTO {
  /** 10進文字列の原価（例: "600", "1234.56"）。消費側で `Money.fromDecimalString` に渡す。 */
  costPrice: string;
}
