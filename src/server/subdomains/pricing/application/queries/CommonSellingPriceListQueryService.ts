import { CommonSellingPriceListItemDTO } from "./dto/CommonSellingPriceListItemDTO";

/**
 * 共通売単価 保守一覧の読みモデル（#429 保守画面・read 関心）。
 *
 * 母集合は全商品（マスタ）。商品ごとに参照日（今日）で有効な共通売単価を1件添えて一覧化する。
 * 集約・Repository を介さず Prisma 直当てで DTO を返す（既存 QueryService 規約）。
 */
export interface CommonSellingPriceListQueryService {
  /**
   * 全商品に現在有効単価を添えた一覧を返す。
   *
   * @param input.referenceDate `"YYYY-MM-DD"` 暦日（今日）。アプリ層が `toJstCalendarDay` で生成して
   *   注入する（`CURRENT_DATE` 不使用・DB サーバー TZ 非依存・ADR-20260627-86b）。
   */
  list(input: { referenceDate: string }): Promise<CommonSellingPriceListItemDTO[]>;
}
