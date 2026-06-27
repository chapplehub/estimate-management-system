import { ResolveCommonSellingPriceQuery } from "../queries/ResolveCommonSellingPriceQuery";
import { ResolveCostPriceQuery } from "../queries/ResolveCostPriceQuery";
import { ResolveCustomerSellingPriceQuery } from "../queries/ResolveCustomerSellingPriceQuery";
import { ResolveDeliveryLocationSellingPriceQuery } from "../queries/ResolveDeliveryLocationSellingPriceQuery";
import { ResolveSellingPriceQuery } from "../queries/ResolveSellingPriceQuery";
import { PrismaCommonSellingPriceQueryService } from "../../infrastructure/queries/PrismaCommonSellingPriceQueryService";
import { PrismaCostPriceQueryService } from "../../infrastructure/queries/PrismaCostPriceQueryService";
import { PrismaCustomerSellingPriceQueryService } from "../../infrastructure/queries/PrismaCustomerSellingPriceQueryService";
import { PrismaDeliveryLocationSellingPriceQueryService } from "../../infrastructure/queries/PrismaDeliveryLocationSellingPriceQueryService";

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
