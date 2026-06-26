import { DeliveryLocationSellingPriceQueryService } from "./DeliveryLocationSellingPriceQueryService";
import { SellingPriceResolutionDTO } from "./dto/SellingPriceResolutionDTO";

export type ResolveDeliveryLocationSellingPriceInput = {
  deliveryLocationId: string;
  productId: string;
  /** 有効な納品先別販売単価を解決する基準暦日（`"YYYY-MM-DD"`・ADR-20260624-95f）。 */
  date: string;
};

/**
 * 基準暦日に有効な納品先別販売単価を解決する読み取りクエリ（価格決定フェーズ B・#459）。
 *
 * 共通層の {@link ResolveCommonSellingPriceQuery}・得意先別の {@link ResolveCustomerSellingPriceQuery} と
 * 同型の薄い委譲。該当が無い場合は `null` を返し（想定内の解決不能）、提出区分での選び分け・共通への
 * フォールバック・エラー化は文脈を持つ上位（価格決定 #428）の責務とする。
 */
export class ResolveDeliveryLocationSellingPriceQuery {
  constructor(private readonly queryService: DeliveryLocationSellingPriceQueryService) {}

  async execute(
    input: ResolveDeliveryLocationSellingPriceInput
  ): Promise<SellingPriceResolutionDTO | null> {
    return await this.queryService.resolve({
      deliveryLocationId: input.deliveryLocationId,
      productId: input.productId,
      date: input.date,
    });
  }
}
