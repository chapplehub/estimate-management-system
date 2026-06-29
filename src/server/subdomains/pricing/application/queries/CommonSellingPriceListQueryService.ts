import {
  CommonSellingPriceListItemDTO,
  CommonSellingPricePriceStatus,
} from "./dto/CommonSellingPriceListItemDTO";

/**
 * 共通売単価 保守一覧の読みモデル（#429 保守画面・read 関心）。
 *
 * 母集合は全商品（マスタ）。商品ごとに参照日（今日）で有効な共通売単価を1件添えて一覧化する。
 * 検索条件（商品コード／商品名／単価状態）での絞り込みは BE 側で1クエリに寄せる（FE での全件取得→
 * 絞り込みを避ける・#473）。集約・Repository を介さず Prisma 直当てで DTO を返す（既存 QueryService 規約）。
 */
export interface CommonSellingPriceListQueryService {
  /**
   * 全商品に現在有効単価を添えた一覧を、検索条件で絞り込んで返す。
   *
   * @param input.referenceDate `"YYYY-MM-DD"` 暦日（今日）。アプリ層が `toJstCalendarDay` で生成して
   *   注入する（`CURRENT_DATE` 不使用・DB サーバー TZ 非依存・ADR-20260627-86b）。
   * @param input.code 商品コードの部分一致（大小無視）。未指定は無条件。
   * @param input.name 商品名の部分一致（大小無視）。未指定は無条件。
   * @param input.priceStatus 単価状態での絞り込み（active／lapsed／unset）。未指定は無条件。
   */
  list(input: {
    referenceDate: string;
    code?: string;
    name?: string;
    priceStatus?: CommonSellingPricePriceStatus;
  }): Promise<CommonSellingPriceListItemDTO[]>;
}
