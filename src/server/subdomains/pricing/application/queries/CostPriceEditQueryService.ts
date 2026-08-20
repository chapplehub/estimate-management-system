import { CostPriceEditDTO } from "./dto/CostPriceEditDTO";

/**
 * 原価 編集画面の読みモデル（#500 保守画面・read 関心）。
 *
 * 1商品の集約スナップショット（version＋期間行＋各行の時点状態）を編集フォーム向けに返す。集約・
 * Repository を介さず Prisma 直当てで DTO を返す（既存 QueryService 規約）。
 * 共通売単価 `CommonSellingPriceEditQueryService` の同型ミラー（ADR-20260627-a5c）。
 */
export interface CostPriceEditQueryService {
  /**
   * 指定**商品コード**の編集用スナップショットを返す。商品が存在しなければ `null`（FE は `notFound()`）。
   * 商品は在るが原価が未登録なら identity＋`version: null`＋空 `periods`（新規登録モード）を返す。
   *
   * @param input.productCode 商品コード（route の `[productCd]`）。これをキーに identity を解決する。
   * @param input.referenceDate `"YYYY-MM-DD"` 暦日（今日）。各行の時点状態算出に用いる。アプリ層が
   *   `toJstCalendarDay` で生成して注入する（`CURRENT_DATE` 不使用・ADR-20260627-86b）。
   */
  find(input: { productCode: string; referenceDate: string }): Promise<CostPriceEditDTO | null>;
}
