/**
 * 期間行の時点状態（参照日＝今日 を基準にした行の位置づけ・ADR-20260627-86b 軸1）。
 *
 * - `future`: 今日 < 開始（まだどの見積も時点解決していない・全項目編集／削除が可能）
 * - `active`: 開始 ≤ 今日 < 終了（現在有効・適用終了のみ可）
 * - `expired`: 今日 ≥ 終了（過去・編集／削除不可）
 *
 * 読み側で算出し、UI の操作可否（編集／適用終了／削除ボタンの出し分け）の判断材料にする。判定は
 * 集約の `ApplicablePeriod.contains`・一覧の `daterange @>` と同一の半開区間意味論で揃える。
 */
export type CommonSellingPricePeriodStatus = "future" | "active" | "expired";

/** 編集画面の期間行1件 DTO。 */
export interface CommonSellingPriceEditPeriodDTO {
  periodId: string;
  start: string;
  end: string | null;
  /** 10進文字列の売単価（消費側で `Money.fromDecimalString`）。 */
  sellingPrice: string;
  status: CommonSellingPricePeriodStatus;
}

/**
 * 共通売単価 編集画面の読みモデル DTO（#429・read 関心）。
 *
 * 親（集約ルート）に version を1つ持つ。version は楽観ロックトークンで、編集フォームが往復させ保存時に
 * `expectedVersion` として戻す（ADR-0039。参照日が実行時生成なのと逆方向＝過去から運ぶ）。期間行は
 * `lower(applicable_period)` 昇順の配列で、各行に時点状態を添える。Decimal は文字列で運ぶ。
 */
export interface CommonSellingPriceEditDTO {
  productId: string;
  version: number;
  periods: CommonSellingPriceEditPeriodDTO[];
}
