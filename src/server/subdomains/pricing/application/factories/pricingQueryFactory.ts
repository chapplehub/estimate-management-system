import { ResolveCommonSellingPriceQuery } from "../queries/ResolveCommonSellingPriceQuery";
import { ResolveCustomerSellingPriceQuery } from "../queries/ResolveCustomerSellingPriceQuery";
import { ResolveDeliveryLocationSellingPriceQuery } from "../queries/ResolveDeliveryLocationSellingPriceQuery";
import { PrismaCommonSellingPriceQueryService } from "../../infrastructure/queries/PrismaCommonSellingPriceQueryService";
import { PrismaCustomerSellingPriceQueryService } from "../../infrastructure/queries/PrismaCustomerSellingPriceQueryService";
import { PrismaDeliveryLocationSellingPriceQueryService } from "../../infrastructure/queries/PrismaDeliveryLocationSellingPriceQueryService";

export function resolveCommonSellingPriceQueryFactory(): ResolveCommonSellingPriceQuery {
  return new ResolveCommonSellingPriceQuery(new PrismaCommonSellingPriceQueryService());
}

export function resolveCustomerSellingPriceQueryFactory(): ResolveCustomerSellingPriceQuery {
  return new ResolveCustomerSellingPriceQuery(new PrismaCustomerSellingPriceQueryService());
}

export function resolveDeliveryLocationSellingPriceQueryFactory(): ResolveDeliveryLocationSellingPriceQuery {
  return new ResolveDeliveryLocationSellingPriceQuery(
    new PrismaDeliveryLocationSellingPriceQueryService()
  );
}
