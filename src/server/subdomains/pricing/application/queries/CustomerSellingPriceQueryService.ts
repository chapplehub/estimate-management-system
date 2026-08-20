import { SellingPriceResolutionDTO } from "./dto/SellingPriceResolutionDTO";

/**
 * 得意先別販売単価の時点解決クエリサービス（価格決定フェーズ B・ADR-0066 / 20260624-8tg）。
 *
 * ある得意先 × 商品の、ある暦日に有効な得意先別販売単価を1件解決する read 関心の入口。集約・Repository を
 * 介さず Prisma 直当てで DTO を返す（既存 QueryService 規約）。共通層（{@link CommonSellingPriceQueryService}）と
 * 同型だが、宛先が得意先である別サービスとして実装する。判別子で1本化すると #428 の「得意先宛なのに納品先別を
 * 引く」誤りを型で防げなくなるため、層ごとに分ける（ADR-20260624-8tg）。
 */
export interface CustomerSellingPriceQueryService {
  /**
   * 指定の得意先 × 商品の、指定暦日に有効な得意先別販売単価を解決する。
   *
   * @param input.customerId 得意先 ID
   * @param input.productId 商品 ID
   * @param input.date `"YYYY-MM-DD"` 暦日。見積年月日(`Date`)→JST 暦日の変換は呼び出し側（価格決定）の
   *   責務で、ここには変換済みの暦日文字列を渡す（ADR-20260624-95f）。
   * @returns 当該暦日を覆う適用期間が無ければ `null`。解決不能の翻訳（エラー化）・画面メッセージ化は
   *   文脈を持つ上位の責務とし、ここでは検出に留める。
   */
  resolve(input: {
    customerId: string;
    productId: string;
    date: string;
  }): Promise<SellingPriceResolutionDTO | null>;
}
