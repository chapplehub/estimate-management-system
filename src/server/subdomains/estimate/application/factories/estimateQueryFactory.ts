import { GetEstimateDetailQuery } from "../queries/GetEstimateDetailQuery";
import { ResolveEffectiveTaxRateQuery } from "../queries/ResolveEffectiveTaxRateQuery";
import { SearchEstimatesQuery } from "../queries/SearchEstimatesQuery";
import { PrismaEstimateQueryService } from "../../infrastructure/queries/PrismaEstimateQueryService";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";

/** 見積詳細取得クエリ（Q1）を組み立てる。読み取りは PrismaEstimateQueryService 実装に閉じる。 */
export function getEstimateDetailQueryFactory(): GetEstimateDetailQuery {
  return new GetEstimateDetailQuery(new PrismaEstimateQueryService());
}

/** 見積一覧取得クエリを組み立てる。代表選択・名前解決は PrismaEstimateQueryService に閉じる（ADR-0051）。 */
export function searchEstimatesQueryFactory(): SearchEstimatesQuery {
  return new SearchEstimatesQuery(new PrismaEstimateQueryService());
}

/** 基準日の有効税率を解決するクエリ（C1 作成画面プレビュー用）。マスタ読み取りに閉じる。 */
export function resolveEffectiveTaxRateQueryFactory(): ResolveEffectiveTaxRateQuery {
  return new ResolveEffectiveTaxRateQuery(new PrismaTaxRateRepository());
}
