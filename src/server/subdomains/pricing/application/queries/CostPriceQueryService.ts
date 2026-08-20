import { CostPriceResolutionDTO } from "./dto/CostPriceResolutionDTO";

/**
 * 原価の時点解決クエリサービス（粗利接続フェーズ・ADR-0066・20260627-a5c）。
 *
 * ある商品の、ある暦日に有効な原価を1件解決する read 関心の入口。集約・Repository を
 * 介さず Prisma 直当てで DTO を返す（既存 QueryService 規約）。
 */
export interface CostPriceQueryService {
  /**
   * 指定商品の、指定暦日に有効な原価を解決する。
   *
   * @param input.productId 商品 ID
   * @param input.date `"YYYY-MM-DD"` 暦日。見積年月日(`Date`)→JST 暦日の変換は呼び出し側の
   *   責務で、ここには変換済みの暦日文字列を渡す（ADR-20260624-95f）。
   * @returns 当該暦日を覆う適用期間が無ければ `null`（期間なし＝原価未設定／複合品も含む）。
   *   解決不能の翻訳・画面メッセージ化は文脈を持つ上位の責務とし、ここでは検出に留める。
   */
  resolve(input: { productId: string; date: string }): Promise<CostPriceResolutionDTO | null>;
}
