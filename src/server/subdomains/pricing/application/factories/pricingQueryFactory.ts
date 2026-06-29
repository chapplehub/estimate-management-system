import { CommonSellingPriceEditQueryService } from "../queries/CommonSellingPriceEditQueryService";
import { CommonSellingPriceListQueryService } from "../queries/CommonSellingPriceListQueryService";
import { ResolveCommonSellingPriceQuery } from "../queries/ResolveCommonSellingPriceQuery";
import { ResolveCostPriceQuery } from "../queries/ResolveCostPriceQuery";
import { ResolveCustomerSellingPriceQuery } from "../queries/ResolveCustomerSellingPriceQuery";
import { ResolveDeliveryLocationSellingPriceQuery } from "../queries/ResolveDeliveryLocationSellingPriceQuery";
import { ResolveSellingPriceQuery } from "../queries/ResolveSellingPriceQuery";
import { PrismaCommonSellingPriceEditQueryService } from "../../infrastructure/queries/PrismaCommonSellingPriceEditQueryService";
import { PrismaCommonSellingPriceListQueryService } from "../../infrastructure/queries/PrismaCommonSellingPriceListQueryService";
import { PrismaCommonSellingPriceQueryService } from "../../infrastructure/queries/PrismaCommonSellingPriceQueryService";
import { PrismaCostPriceQueryService } from "../../infrastructure/queries/PrismaCostPriceQueryService";
import { PrismaCustomerSellingPriceQueryService } from "../../infrastructure/queries/PrismaCustomerSellingPriceQueryService";
import { PrismaDeliveryLocationSellingPriceQueryService } from "../../infrastructure/queries/PrismaDeliveryLocationSellingPriceQueryService";

/**
 * 共通売単価 保守一覧の読みモデル（#429・#473）を Prisma 実装から構築する。
 * 読みモデルは Query ラッパを介さず QueryService インターフェースを直接返す（既存規約）。
 */
export function commonSellingPriceListQueryFactory(): CommonSellingPriceListQueryService {
  return new PrismaCommonSellingPriceListQueryService();
}

/** 共通売単価 編集の読みモデル（#429・#473）を Prisma 実装から構築する。 */
export function commonSellingPriceEditQueryFactory(): CommonSellingPriceEditQueryService {
  return new PrismaCommonSellingPriceEditQueryService();
}

export function resolveCommonSellingPriceQueryFactory(): ResolveCommonSellingPriceQuery {
  return new ResolveCommonSellingPriceQuery(new PrismaCommonSellingPriceQueryService());
}

/** 原価の時点解決ラッパを Prisma QueryService から構築する（粗利接続フェーズで消費）。 */
export function resolveCostPriceQueryFactory(): ResolveCostPriceQuery {
  return new ResolveCostPriceQuery(new PrismaCostPriceQueryService());
}

export function resolveCustomerSellingPriceQueryFactory(): ResolveCustomerSellingPriceQuery {
  return new ResolveCustomerSellingPriceQuery(new PrismaCustomerSellingPriceQueryService());
}

export function resolveDeliveryLocationSellingPriceQueryFactory(): ResolveDeliveryLocationSellingPriceQuery {
  return new ResolveDeliveryLocationSellingPriceQuery(
    new PrismaDeliveryLocationSellingPriceQueryService()
  );
}

/**
 * 価格決定の2段解決オーケストレーション（#428）を組み立てる。
 *
 * 3層の時点解決ラッパ（共通／得意先別／納品先別）を Prisma QueryService から構築して注入する。
 * 消費側（#430 見積接続）はこの factory 経由で `ResolveSellingPriceQuery` を得る。
 */
export function resolveSellingPriceQueryFactory(): ResolveSellingPriceQuery {
  return new ResolveSellingPriceQuery(
    resolveCommonSellingPriceQueryFactory(),
    resolveCustomerSellingPriceQueryFactory(),
    resolveDeliveryLocationSellingPriceQueryFactory()
  );
}
