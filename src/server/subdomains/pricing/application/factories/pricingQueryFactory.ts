import { ResolveCommonSellingPriceQuery } from "../queries/ResolveCommonSellingPriceQuery";
import { PrismaCommonSellingPriceQueryService } from "../../infrastructure/queries/PrismaCommonSellingPriceQueryService";

export function resolveCommonSellingPriceQueryFactory(): ResolveCommonSellingPriceQuery {
  return new ResolveCommonSellingPriceQuery(new PrismaCommonSellingPriceQueryService());
}
