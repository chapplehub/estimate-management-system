import { SellingPriceResolutionDTO } from "./dto/SellingPriceResolutionDTO";

/**
 * 納品先別販売単価の時点解決クエリサービス（価格決定フェーズ B・ADR-0066 / 20260624-8tg）。
 *
 * ある納品先 × 商品の、ある暦日に有効な納品先別販売単価を1件解決する read 関心の入口。集約・Repository を
 * 介さず Prisma 直当てで DTO を返す（既存 QueryService 規約）。共通層・得意先別層と同型だが、宛先が納品先で
 * ある別サービスとして実装する。判別子で1本化すると #428 の「納品先宛なのに得意先別を引く」誤りを型で
 * 防げなくなるため、層ごとに分ける（ADR-20260624-8tg）。
 */
export interface DeliveryLocationSellingPriceQueryService {
  /**
   * 指定の納品先 × 商品の、指定暦日に有効な納品先別販売単価を解決する。
   *
   * @param input.deliveryLocationId 納品先 ID
   * @param input.productId 商品 ID
   * @param input.date `"YYYY-MM-DD"` 暦日。見積年月日(`Date`)→JST 暦日の変換は呼び出し側（価格決定）の
   *   責務で、ここには変換済みの暦日文字列を渡す（ADR-20260624-95f）。
   * @returns 当該暦日を覆う適用期間が無ければ `null`。解決不能の翻訳（エラー化）・画面メッセージ化は
   *   文脈を持つ上位の責務とし、ここでは検出に留める。
   */
  resolve(input: {
    deliveryLocationId: string;
    productId: string;
    date: string;
  }): Promise<SellingPriceResolutionDTO | null>;
}
