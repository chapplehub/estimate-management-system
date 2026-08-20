import { EstimateApplicationSearchQueryService } from "./EstimateApplicationSearchQueryService";
import { EstimateApplicationSummaryDTO } from "./dto/EstimateApplicationSummaryDTO";
import {
  EstimateApplicationListOptions,
  EstimateApplicationSearchCriteria,
} from "./dto/EstimateApplicationSearchCriteria";

/**
 * 見積申請一覧検索クエリ（/estimate-applications・#571）。
 *
 * #559 の GetVariationApplicationStatesQuery と同型の薄い委譲。読み取りロジック（Prisma 直読み＋
 * 不変事実の SQL 絞り込み＋ドメイン共有関数での還元＋導出条件のアプリ層フィルタ）は
 * PrismaEstimateApplicationSearchQueryService に閉じる（ADR-20260707-b36）。
 */
export class SearchEstimateApplicationsQuery {
  constructor(private readonly queryService: EstimateApplicationSearchQueryService) {}

  async execute(
    criteria: EstimateApplicationSearchCriteria,
    options?: EstimateApplicationListOptions
  ): Promise<EstimateApplicationSummaryDTO[]> {
    return this.queryService.search(criteria, options);
  }
}
