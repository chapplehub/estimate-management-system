import { CostPriceQueryService } from "./CostPriceQueryService";
import { CostPriceResolutionDTO } from "./dto/CostPriceResolutionDTO";

export type ResolveCostPriceInput = {
  productId: string;
  /** 有効な原価を解決する基準暦日（`"YYYY-MM-DD"`・ADR-20260624-95f）。 */
  date: string;
};

/**
 * 基準暦日に有効な原価を解決する読み取りクエリ（粗利接続フェーズ・ADR-20260627-a5c）。
 *
 * 共通売単価の {@link ResolveCommonSellingPriceQuery} と同型の薄い委譲。該当が無い場合は `null` を
 * 返し（想定内の解決不能。期間なし＝原価未設定／複合品）、エラー化・画面メッセージ化は文脈を持つ
 * 上位（粗利接続／presentation）の責務とする。
 */
export class ResolveCostPriceQuery {
  constructor(private readonly queryService: CostPriceQueryService) {}

  async execute(input: ResolveCostPriceInput): Promise<CostPriceResolutionDTO | null> {
    return await this.queryService.resolve({ productId: input.productId, date: input.date });
  }
}
