import { CustomerSellingPriceEditDTO } from "./dto/CustomerSellingPriceEditDTO";

/**
 * 得意先別販売単価 編集画面の読みモデル（#506 保守画面・read 関心）。
 *
 * 得意先 × 商品1組の集約スナップショット（version＋期間行＋各行の時点状態）を編集フォーム向けに返す。
 * 集約・Repository を介さず Prisma 直当てで DTO を返す（既存 QueryService 規約）。共通販売単価の
 * `CommonSellingPriceEditQueryService` と同型で、identity が複合自然キー（得意先コード × 商品コード）で
 * ある点だけが異なる。
 */
export interface CustomerSellingPriceEditQueryService {
  /**
   * 指定**得意先コード × 商品コード**の編集用スナップショットを返す。得意先または商品が存在しなければ
   * `null`（FE は `notFound()`。どちらが不在かは区別しない）。両方在るが得意先別販売単価が上書きなし
   * （集約なし）なら identity＋`version: null`＋空 `periods`（新規登録モード）を返す。
   *
   * @param input.customerCode 得意先コード（route の `[customerCd]`）。これをキーに identity を解決する。
   * @param input.productCode 商品コード（route の `[productCd]`）。これをキーに identity を解決する。
   * @param input.referenceDate `"YYYY-MM-DD"` 暦日（今日）。各行の時点状態算出に用いる。アプリ層が
   *   `toJstCalendarDay` で生成して注入する（`CURRENT_DATE` 不使用・ADR-20260627-86b）。
   */
  find(input: {
    customerCode: string;
    productCode: string;
    referenceDate: string;
  }): Promise<CustomerSellingPriceEditDTO | null>;
}
