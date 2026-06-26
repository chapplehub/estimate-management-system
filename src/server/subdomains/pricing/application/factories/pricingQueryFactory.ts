import { ResolveCommonSellingPriceQuery } from "../queries/ResolveCommonSellingPriceQuery";
import { ResolveCustomerSellingPriceQuery } from "../queries/ResolveCustomerSellingPriceQuery";
import { PrismaCommonSellingPriceQueryService } from "../../infrastructure/queries/PrismaCommonSellingPriceQueryService";
import { PrismaCustomerSellingPriceQueryService } from "../../infrastructure/queries/PrismaCustomerSellingPriceQueryService";

export function resolveCommonSellingPriceQueryFactory(): ResolveCommonSellingPriceQuery {
  return new ResolveCommonSellingPriceQuery(new PrismaCommonSellingPriceQueryService());
}

export function resolveCustomerSellingPriceQueryFactory(): ResolveCustomerSellingPriceQuery {
  return new ResolveCustomerSellingPriceQuery(new PrismaCustomerSellingPriceQueryService());
}
