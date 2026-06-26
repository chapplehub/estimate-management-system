/**
 * 販売単価の時点解決結果 DTO（共通・得意先別・納品先別の3層で共有）。
 *
 * ある暦日に有効な販売単価を1件返す read 関心の結果（ADR-0066）。層ごとに identity（複合自然キー）は
 * 異なるが、解決結果は「その時点の単価1つ」でしかなく、キーも層の分岐軸も持たない。ゆえに層名を冠さない
 * 単一の値の形として共有する（畳んでも新たな構造を生まないため統合してよい）。価格決定（#428）の
 * `override ?? common` フォールバックが単一型で書ける利点も得る。
 *
 * `sellingPrice` は精度保持のため `::text` で取り出した10進文字列で運ぶ。消費側（価格決定）が
 * `Money.fromDecimalString` で包んで使う前提で、float64 を一切通さない（pricing Mapper と同じ厳密変換の
 * 規律）。ドメイン VO（Money/SellingUnitPrice）は QueryService の境界を越えさせない。
 */
export interface SellingPriceResolutionDTO {
  /** 10進文字列の販売単価（例: "1000", "1234.56"）。消費側で `Money.fromDecimalString` に渡す。 */
  sellingPrice: string;
}
