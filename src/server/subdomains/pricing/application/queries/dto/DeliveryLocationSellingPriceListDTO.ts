/**
 * 一覧の単価状態（参照日＝今日 を基準にした、納品先別上書きの設定状況・#546／得意先別 #506 と同型）。
 *
 * - `active`: 参照日を覆う納品先別期間行がある（現在有効な上書き単価あり）
 * - `lapsed`: 納品先別期間行は存在するが参照日を覆う行が無い（将来のみ／失効のみ＝失効中）
 * - `none`: 納品先別期間行が1件も無い（**上書きなし**＝この納品先には既定の共通単価が適用される正常状態）
 *
 * 第三状態は共通販売単価の `"unset"`（未設定＝異常状態・保守アクション要求の含意）を流用せず `"none"`
 * とする。上書きレイヤーで行が無いのは正常な既定状態であり、CONTEXT.md の正準語「上書きなし
 * (None / No Override)」に対応する。`currentSellingPrice` の null だけでは `lapsed`/`none` を判別できない
 * ため、業務要件として三状態を BE が直接返す。型は集約ごとに独立複製し共有しない（ADR-20260627-a5c）。
 */
export type DeliveryLocationSellingPricePriceStatus = "active" | "lapsed" | "none";

/**
 * 納品先別販売単価 保守一覧の1行 DTO（read 関心・#546）。行＝価格保守対象商品1件。
 *
 * `currentSellingPrice` は参照日（今日）に有効な**納品先別**単価を「値 or null」の2値で持つ（上書きなし・
 * 将来のみ・失効のみは一様に null）。`priceStatus` で null の内訳（失効中／上書きなし）を区別する。
 * `currentCommonSellingPrice` は同参照日に有効な**共通**単価を独立カラムで並記する（COALESCE しない）。
 * 納品先宛の価格解決連鎖は `納品先別 ?? 共通`（得意先別は連鎖に入らない）なので、比較の基準は共通単価のみ
 * を並置する。フォールバック解決（実効単価）ではなく納品先別・共通の事実を並置し、優遇額の比較に供する。
 *
 * 価格は精度保持のため `::text` の10進文字列で運ぶ（消費側で `Money.fromDecimalString`）。ドメイン VO は
 * QueryService の境界を越えさせない（既存 QueryService 規約）。
 */
export interface DeliveryLocationSellingPriceListItemDTO {
  productId: string;
  productCode: string;
  productName: string;
  /** 商品マスタの有効フラグ（行＝商品なので裸で曖昧さなし。UI 側のバッジ判定に渡す）。 */
  isActive: boolean;
  /** 参照日に有効な納品先別単価の10進文字列。今日有効な上書き行が無ければ null（`priceStatus` で内訳判別）。 */
  currentSellingPrice: string | null;
  /**
   * 現在有効な納品先別行の適用開始日（`"YYYY-MM-DD"`）。有効行が無い（lapsed／none）なら null。
   * `null` ＝有効行なし／`start` あり・`end` null ＝無期限、の2フィールドで多義を捌く（#513・共通一覧と同型）。
   */
  currentPeriodStart: string | null;
  /**
   * 現在有効な納品先別行の適用終了日（半開区間の排他上端の生値・`"YYYY-MM-DD"`）。無期限または有効行なしなら
   * null（編集 DTO の `end: null`＝無期限と同一意味論。包含端への変換は一覧では行わない）。
   */
  currentPeriodEnd: string | null;
  /**
   * 参照日に有効な**共通**単価の10進文字列（並記・COALESCE しない）。共通単価も無ければ null
   * （＝この納品先にも共通にも単価が無い）。納品先別優遇額の比較の基準として並置する。
   */
  currentCommonSellingPrice: string | null;
  /** 納品先別単価の設定状況（active／lapsed／none）。null の `currentSellingPrice` の内訳を区別する。 */
  priceStatus: DeliveryLocationSellingPricePriceStatus;
}

/**
 * 納品先別販売単価 保守一覧の封筒型 DTO（read 関心・#546・#473 素描画方針）。
 *
 * 指定納品先の identity（id/code/name/deliveryLocationIsActive）に加え、**親得意先の identity
 * （customerId/Code/Name）** を封筒に同梱し、行配列（価格保守対象商品×現在有効単価）を包む。親得意先を
 * 同梱するのは、納品先は親得意先の文脈が無いと保守画面ヘッダで意味を成さず、`DeliveryLocation` が既に
 * customer リレーションをモデル化しているため（得意先別 #506 からの唯一の実質的な形状差）。これで FE 側の
 * code→id 二重取得を避ける（#473 素描画方針）。
 *
 * 裸配列（共通販売単価の字面ミラー）ではなく封筒型 `| null` を採るのは、存在しない納品先で LEFT JOIN が
 * 静かに空振りし「全商品が上書きなし」に見える契約事故を、納品先不在→`null` で構造的に排除するため。
 */
export interface DeliveryLocationSellingPriceListDTO {
  deliveryLocationId: string;
  deliveryLocationCode: string;
  deliveryLocationName: string;
  /** 納品先マスタの有効フラグ（無効納品先の一覧ヘッダのバッジ表示用）。 */
  deliveryLocationIsActive: boolean;
  /** 親得意先の識別子（保守画面ヘッダの文脈提示用。納品先は親得意先の文脈が無いと意味を成さない）。 */
  customerId: string;
  customerCode: string;
  customerName: string;
  /** 価格保守対象商品×現在有効な納品先別単価の行配列（productCode 昇順）。 */
  items: DeliveryLocationSellingPriceListItemDTO[];
}
