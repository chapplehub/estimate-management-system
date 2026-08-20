import { CustomerSellingPriceQueryService } from "./CustomerSellingPriceQueryService";
import { SellingPriceResolutionDTO } from "./dto/SellingPriceResolutionDTO";

export type ResolveCustomerSellingPriceInput = {
  customerId: string;
  productId: string;
  /** 有効な得意先別販売単価を解決する基準暦日（`"YYYY-MM-DD"`・ADR-20260624-95f）。 */
  date: string;
};

/**
 * 基準暦日に有効な得意先別販売単価を解決する読み取りクエリ（価格決定フェーズ B・#459）。
 *
 * 共通層の {@link ResolveCommonSellingPriceQuery} と同型の薄い委譲。該当が無い場合は `null` を
 * 返し（想定内の解決不能）、提出区分での選び分け・共通へのフォールバック・エラー化は文脈を持つ
 * 上位（価格決定 #428）の責務とする。
 */
export class ResolveCustomerSellingPriceQuery {
  constructor(private readonly queryService: CustomerSellingPriceQueryService) {}

  async execute(
    input: ResolveCustomerSellingPriceInput
  ): Promise<SellingPriceResolutionDTO | null> {
    return await this.queryService.resolve({
      customerId: input.customerId,
      productId: input.productId,
      date: input.date,
    });
  }
}
