import { GetEstimateDetailQuery } from "../queries/GetEstimateDetailQuery";
import { GetVariationApplicationStatesQuery } from "../queries/GetVariationApplicationStatesQuery";
import { ResolveEffectiveTaxRateQuery } from "../queries/ResolveEffectiveTaxRateQuery";
import { SearchEstimateApplicationsQuery } from "../queries/SearchEstimateApplicationsQuery";
import { SearchEstimatesQuery } from "../queries/SearchEstimatesQuery";
import { PrismaEstimateApplicationSearchQueryService } from "../../infrastructure/queries/PrismaEstimateApplicationSearchQueryService";
import { PrismaEstimateQueryService } from "../../infrastructure/queries/PrismaEstimateQueryService";
import { PrismaVariationApplicationStateQueryService } from "../../infrastructure/queries/PrismaVariationApplicationStateQueryService";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";
import { tryResolveSellingPriceQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";

/**
 * 見積詳細取得クエリ（Q1）を組み立てる。事実取得は PrismaEstimateQueryService に閉じ、単価乖離・
 * 解決不能（#593）の合成には pricing の非throw解決（{@link tryResolveSellingPriceQueryFactory}）を注入する。
 */
export function getEstimateDetailQueryFactory(): GetEstimateDetailQuery {
  return new GetEstimateDetailQuery(
    new PrismaEstimateQueryService(),
    tryResolveSellingPriceQueryFactory()
  );
}

/**
 * バリエーション別 申請状態参照クエリ（S2・#493）を組み立てる。
 * 読み取りは PrismaVariationApplicationStateQueryService に閉じ、還元・前進判定は
 * ドメイン共有関数（書き込みとドリフトしない）を使う。
 */
export function getVariationApplicationStatesQueryFactory(): GetVariationApplicationStatesQuery {
  return new GetVariationApplicationStatesQuery(new PrismaVariationApplicationStateQueryService());
}

/** 見積一覧取得クエリを組み立てる。代表選択・名前解決は PrismaEstimateQueryService に閉じる（ADR-0051）。 */
export function searchEstimatesQueryFactory(): SearchEstimatesQuery {
  return new SearchEstimatesQuery(new PrismaEstimateQueryService());
}

/**
 * 見積申請一覧検索クエリ（/estimate-applications・#571）を組み立てる。読み取りは
 * PrismaEstimateApplicationSearchQueryService に閉じ、状態導出は書き込みと共有の純粋関数を使う
 * （ドリフトしない・ADR-20260707-b36）。
 */
export function searchEstimateApplicationsQueryFactory(): SearchEstimateApplicationsQuery {
  return new SearchEstimateApplicationsQuery(new PrismaEstimateApplicationSearchQueryService());
}

/** 基準日の有効税率を解決するクエリ（C1 作成画面プレビュー用）。マスタ読み取りに閉じる。 */
export function resolveEffectiveTaxRateQueryFactory(): ResolveEffectiveTaxRateQuery {
  return new ResolveEffectiveTaxRateQuery(new PrismaTaxRateRepository());
}
