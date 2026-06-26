import { CommonSellingPriceQueryService } from "./CommonSellingPriceQueryService";
import { SellingPriceResolutionDTO } from "./dto/SellingPriceResolutionDTO";

export type ResolveCommonSellingPriceInput = {
  productId: string;
  /** 有効な共通販売単価を解決する基準暦日（`"YYYY-MM-DD"`・ADR-20260624-95f）。 */
  date: string;
};

/**
 * 基準暦日に有効な共通販売単価を解決する読み取りクエリ（価格決定フェーズ B・#448）。
 *
 * 税率の {@link ResolveEffectiveTaxRateQuery} と同型の薄い委譲。該当が無い場合は `null` を
 * 返し（想定内の解決不能）、エラー化・画面メッセージ化は文脈を持つ上位（価格決定／presentation）
 * の責務とする。
 */
export class ResolveCommonSellingPriceQuery {
  constructor(private readonly queryService: CommonSellingPriceQueryService) {}

  async execute(input: ResolveCommonSellingPriceInput): Promise<SellingPriceResolutionDTO | null> {
    return await this.queryService.resolve({ productId: input.productId, date: input.date });
  }
}
