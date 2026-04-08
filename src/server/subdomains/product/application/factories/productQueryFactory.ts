import { GetProductByIdQuery } from "../queries/GetProductByIdQuery";
import { SearchProductsQuery } from "../queries/SearchProductsQuery";
import { PrismaProductQueryService } from "../../infrastructure/queries/PrismaProductQueryService";

export function getProductByIdQueryFactory(): GetProductByIdQuery {
  return new GetProductByIdQuery(new PrismaProductQueryService());
}

export function searchProductsQueryFactory(): SearchProductsQuery {
  return new SearchProductsQuery(new PrismaProductQueryService());
}
