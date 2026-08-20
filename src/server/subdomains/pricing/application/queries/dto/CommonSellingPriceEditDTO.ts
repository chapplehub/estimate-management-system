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
 * 共通売単価 編集画面の読みモデル DTO（#429・read 関心・#473 で productCode キー化）。
 *
 * 商品 identity（id/code/name/isActive）を同梱し、FE 側の code→id 解決クエリ・商品名の二重取得を不要に
 * する（#473・FE 素描画方針）。`productId` はコマンド宛先キーとしてフォームが往復させる。
 *
 * version は楽観ロックトークンで、編集フォームが往復させ保存時に `expectedVersion` として戻す
 * （ADR-0039。参照日が実行時生成なのと逆方向＝過去から運ぶ）。共通売単価が**未設定**（集約なし）でも
 * 商品が在れば identity を返し `version: null`＝新規登録モードとする（`periods` は空配列）。商品自体が
 * 存在しない場合のみ QueryService は `null` を返す（FE は `notFound()`）。
 *
 * 期間行は `lower(applicable_period)` 昇順の配列で、各行に時点状態を添える。Decimal は文字列で運ぶ。
 */
export interface CommonSellingPriceEditDTO {
  productId: string;
  productCode: string;
  productName: string;
  /** 商品マスタの有効フラグ（無効商品の編集時バッジ表示用）。 */
  isActive: boolean;
  /** 楽観ロックトークン。未設定（集約なし＝新規登録モード）なら null。 */
  version: number | null;
  periods: CommonSellingPriceEditPeriodDTO[];
}
