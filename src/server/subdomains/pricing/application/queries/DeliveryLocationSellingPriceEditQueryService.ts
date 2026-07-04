import { DeliveryLocationSellingPriceEditDTO } from "./dto/DeliveryLocationSellingPriceEditDTO";

/**
 * 納品先別販売単価 編集画面の読みモデル（#546 保守画面・read 関心）。
 *
 * 納品先 × 商品1組の集約スナップショット（version＋期間行＋各行の時点状態）を編集フォーム向けに返す。
 * 集約・Repository を介さず Prisma 直当てで DTO を返す（既存 QueryService 規約）。得意先別
 * `CustomerSellingPriceEditQueryService` と同型で、identity が複合自然キー（納品先コード × 商品コード）で
 * あり、封筒に親得意先 identity を同梱する点だけが異なる。
 */
export interface DeliveryLocationSellingPriceEditQueryService {
  /**
   * 指定**納品先コード × 商品コード**の編集用スナップショットを返す。納品先または商品が存在しなければ
   * `null`（FE は `notFound()`。どちらが不在かは区別しない）。両方在るが納品先別販売単価が上書きなし
   * （集約なし）なら identity＋`version: null`＋空 `periods`（新規登録モード）を返す。
   *
   * @param input.deliveryLocationCode 納品先コード（route の `[deliveryLocationCd]`）。これをキーに
   *   identity を解決する。
   * @param input.productCode 商品コード（route の `[productCd]`）。これをキーに identity を解決する。
   * @param input.referenceDate `"YYYY-MM-DD"` 暦日（今日）。各行の時点状態算出に用いる。アプリ層が
   *   `toJstCalendarDay` で生成して注入する（`CURRENT_DATE` 不使用・ADR-20260627-86b）。
   */
  find(input: {
    deliveryLocationCode: string;
    productCode: string;
    referenceDate: string;
  }): Promise<DeliveryLocationSellingPriceEditDTO | null>;
}
