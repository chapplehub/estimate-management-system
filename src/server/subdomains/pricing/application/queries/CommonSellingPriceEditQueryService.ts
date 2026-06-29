import { CommonSellingPriceEditDTO } from "./dto/CommonSellingPriceEditDTO";

/**
 * 共通売単価 編集画面の読みモデル（#429 保守画面・read 関心）。
 *
 * 1商品の集約スナップショット（version＋期間行＋各行の時点状態）を編集フォーム向けに返す。集約・
 * Repository を介さず Prisma 直当てで DTO を返す（既存 QueryService 規約）。
 */
export interface CommonSellingPriceEditQueryService {
  /**
   * 指定商品の編集用スナップショットを返す。共通売単価が未登録なら `null`（新規登録モード）。
   *
   * @param input.referenceDate `"YYYY-MM-DD"` 暦日（今日）。各行の時点状態算出に用いる。アプリ層が
   *   `toJstCalendarDay` で生成して注入する（`CURRENT_DATE` 不使用・ADR-20260627-86b）。
   */
  find(input: {
    productId: string;
    referenceDate: string;
  }): Promise<CommonSellingPriceEditDTO | null>;
}
