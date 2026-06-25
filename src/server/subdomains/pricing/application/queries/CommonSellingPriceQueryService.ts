import { CommonSellingPriceResolutionDTO } from "./dto/CommonSellingPriceResolutionDTO";

/**
 * 共通販売単価の時点解決クエリサービス（価格決定フェーズ B・ADR-0066）。
 *
 * ある商品の、ある暦日に有効な共通販売単価を1件解決する read 関心の入口。集約・Repository を
 * 介さず Prisma 直当てで DTO を返す（既存 QueryService 規約）。
 */
export interface CommonSellingPriceQueryService {
  /**
   * 指定商品の、指定暦日に有効な共通販売単価を解決する。
   *
   * @param input.productId 商品 ID
   * @param input.date `"YYYY-MM-DD"` 暦日。見積年月日(`Date`)→JST 暦日の変換は呼び出し側（価格決定）の
   *   責務で、ここには変換済みの暦日文字列を渡す（ADR-20260624-95f）。
   * @returns 当該暦日を覆う適用期間が無ければ `null`。解決不能の翻訳（エラー化）・画面メッセージ化は
   *   文脈を持つ上位の責務とし、ここでは検出に留める。
   */
  resolve(input: {
    productId: string;
    date: string;
  }): Promise<CommonSellingPriceResolutionDTO | null>;
}
