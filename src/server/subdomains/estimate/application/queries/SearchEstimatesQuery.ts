import { EstimateQueryService } from "./EstimateQueryService";
import { EstimateSummaryDTO } from "./dto/EstimateSummaryDTO";
import { EstimateListOptions, EstimateSearchCriteria } from "./dto/EstimateSearchCriteria";

/**
 * 見積一覧取得クエリ。product の SearchProductsQuery と同型の薄い委譲。
 * 読み取りロジック（代表選択・名前解決・並び順）は PrismaEstimateQueryService に閉じる。
 */
export class SearchEstimatesQuery {
  constructor(private readonly estimateQueryService: EstimateQueryService) {}

  async execute(
    criteria: EstimateSearchCriteria,
    options?: EstimateListOptions
  ): Promise<EstimateSummaryDTO[]> {
    return await this.estimateQueryService.search(criteria, options);
  }
}
