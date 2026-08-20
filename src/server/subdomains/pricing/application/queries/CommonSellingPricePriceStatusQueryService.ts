import { CommonSellingPricePriceStatus } from "./dto/CommonSellingPriceListItemDTO";

/**
 * 単一商品の共通売単価 単価状態（三状態）の読みモデル（#487・商品側起点のアナウンス）。
 *
 * 保守一覧（#473）が全商品に添える三状態 `priceStatus` を、商品詳細画面（product サブドメイン文脈）から
 * 1商品ぶんだけ引くための read。三状態の判定ロジックは業務要件として BE 側に閉じ込め、FE へ漏らさない
 * （一覧クエリの CASE 式を単一商品にミラー）。集約・Repository を介さず Prisma 直当てで返す（既存 QueryService 規約）。
 */
export interface CommonSellingPricePriceStatusQueryService {
  /**
   * 指定**商品コード**の参照日における三状態 `priceStatus` を返す。商品が存在しなければ `null`。
   *
   * @param input.productCode 商品コード（route の `[productCd]`）。
   * @param input.referenceDate `"YYYY-MM-DD"` 暦日（今日）。有効期間の判定に用いる。アプリ層が
   *   `toJstCalendarDay` で生成して注入する（`CURRENT_DATE` 不使用・ADR-20260627-86b）。
   */
  find(input: {
    productCode: string;
    referenceDate: string;
  }): Promise<CommonSellingPricePriceStatus | null>;
}
