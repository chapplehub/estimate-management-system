/**
 * 期間行の時点状態（参照日＝今日 を基準にした行の位置づけ・ADR-20260627-86b 軸1）。
 *
 * - `future`: 今日 < 開始（まだどの見積も時点解決していない・全項目編集／削除が可能）
 * - `active`: 開始 ≤ 今日 < 終了（現在有効・適用終了のみ可）
 * - `expired`: 今日 ≥ 終了（過去・編集／削除不可）
 *
 * 読み側で算出し、UI の操作可否（編集／適用終了／削除ボタンの出し分け）の判断材料にする。判定は
 * 集約の `ApplicablePeriod.contains`・一覧の `daterange @>` と同一の半開区間意味論で揃える。
 *
 * 得意先別・共通販売単価の同名型と字面は同一だが、型は集約ごとに独立複製し共有しない
 * （ADR-20260627-a5c）。
 */
export type DeliveryLocationSellingPricePeriodStatus = "future" | "active" | "expired";

/** 編集画面の期間行1件 DTO。 */
export interface DeliveryLocationSellingPriceEditPeriodDTO {
  periodId: string;
  start: string;
  end: string | null;
  /** 10進文字列の売単価（消費側で `Money.fromDecimalString`）。 */
  sellingPrice: string;
  status: DeliveryLocationSellingPricePeriodStatus;
}

/**
 * 納品先別販売単価 編集画面の読みモデル DTO（#546・read 関心）。
 *
 * 納品先 identity（id/code/name/deliveryLocationIsActive）・商品 identity（id/code/name/productIsActive）に
 * 加え、**親得意先 identity（id/code/name）** を同梱し、FE 側の code→id 解決クエリ・名称の二重取得を不要に
 * する（#473・FE 素描画方針）。親得意先を載せるのは、納品先は親得意先の文脈が無いと保守画面ヘッダで意味を
 * 成さないため。3エンティティ（納品先・商品・親得意先）が載る DTO の自己記述性のため、有効フラグは裸の
 * `isActive` ではなく `deliveryLocationIsActive`/`productIsActive` の接頭辞命名で載せる（親得意先の有効フラグは
 * 保守の判断材料にならないため同梱しない）。`deliveryLocationId`/`productId` はコマンド宛先キーとして
 * フォームが往復させる。
 *
 * version は楽観ロックトークンで、編集フォームが往復させ保存時に `expectedVersion` として戻す
 * （ADR-0039）。納品先別販売単価が**上書きなし**（集約なし＝行が無いのは正常な既定状態）でも、納品先・商品が
 * ともに在れば identity を返し `version: null`＝新規登録モードとする（`periods` は空配列・Register コマンドと
 * 1:1対応）。この安全性は #512 の解決（最終期間削除で集約ルートごと削除→「集約が存在する ⇔ 期間行が1件
 * 以上」の不変条件）に依拠する。納品先または商品が存在しない場合のみ QueryService は `null` を返す
 * （FE は `notFound()`。どちらが不在かは区別しない）。
 *
 * 期間行は `lower(applicable_period)` 昇順の配列で、各行に時点状態を添える。Decimal は文字列で運ぶ。
 */
export interface DeliveryLocationSellingPriceEditDTO {
  deliveryLocationId: string;
  deliveryLocationCode: string;
  deliveryLocationName: string;
  /** 納品先マスタの有効フラグ（無効納品先の編集時バッジ表示用）。 */
  deliveryLocationIsActive: boolean;
  productId: string;
  productCode: string;
  productName: string;
  /** 商品マスタの有効フラグ（無効商品の編集時バッジ表示用）。 */
  productIsActive: boolean;
  /** 親得意先の識別子（保守画面ヘッダの文脈提示用。納品先は親得意先の文脈が無いと意味を成さない）。 */
  customerId: string;
  customerCode: string;
  customerName: string;
  /** 楽観ロックトークン。上書きなし（集約なし＝新規登録モード）なら null。 */
  version: number | null;
  periods: DeliveryLocationSellingPriceEditPeriodDTO[];
}
