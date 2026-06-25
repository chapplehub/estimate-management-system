/**
 * 共通販売単価の時点解決結果 DTO。
 *
 * ある暦日に有効な共通販売単価を1件返す（read 関心・ADR-0066）。`sellingPrice` は精度保持の
 * ため `::text` で取り出した10進文字列で運ぶ。消費側（価格決定）が `Money.fromDecimalString`
 * で包んで使う前提で、float64 を一切通さない（pricing Mapper と同じ厳密変換の規律）。
 * ドメイン VO（Money/SellingUnitPrice）は QueryService の境界を越えさせない。
 */
export interface CommonSellingPriceResolutionDTO {
  /** 10進文字列の販売単価（例: "1000", "1234.56"）。消費側で `Money.fromDecimalString` に渡す。 */
  sellingPrice: string;
}
