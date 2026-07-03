import {
  CustomerSellingPriceListDTO,
  CustomerSellingPricePriceStatus,
} from "./dto/CustomerSellingPriceListDTO";

/**
 * 得意先別販売単価 保守一覧の読みモデル（#506 保守画面・read 関心）。
 *
 * 指定得意先について、価格保守対象商品（個別商品・消耗品。セット商品を除く）ごとに参照日（今日）で有効な
 * 得意先別単価を1件添え、同参照日の共通単価を並記して一覧化する。上書きが無い商品も母集合に含めるため、
 * 一覧から新規登録の動線が立つ。検索条件（商品コード／商品名／単価状態）での絞り込みは BE 側で1クエリに
 * 寄せる（FE での全件取得→絞り込みを避ける・#473）。集約・Repository を介さず Prisma 直当てで DTO を返す
 * （既存 QueryService 規約）。
 */
export interface CustomerSellingPriceListQueryService {
  /**
   * 指定**得意先コード**の一覧封筒（得意先 identity + 商品行配列）を、検索条件で絞り込んで返す。
   * 得意先が存在しなければ `null`（FE は `notFound()`）。裸配列ではなく封筒型 `| null` を返すのは、
   * 存在しない得意先で全商品が「上書きなし」に化ける契約事故を構造的に排除するため。
   *
   * @param input.customerCode 得意先コード（route の `[customerCd]`）。これをキーに identity を解決する。
   * @param input.referenceDate `"YYYY-MM-DD"` 暦日（今日）。アプリ層が `toJstCalendarDay` で生成して
   *   注入する（`CURRENT_DATE` 不使用・DB サーバー TZ 非依存・ADR-20260627-86b）。
   * @param input.code 商品コードの部分一致（大小無視）。未指定は無条件。
   * @param input.name 商品名の部分一致（大小無視）。未指定は無条件。
   * @param input.priceStatus 得意先別単価状態での絞り込み（active／lapsed／none）。未指定は無条件。
   */
  find(input: {
    customerCode: string;
    referenceDate: string;
    code?: string;
    name?: string;
    priceStatus?: CustomerSellingPricePriceStatus;
  }): Promise<CustomerSellingPriceListDTO | null>;
}
