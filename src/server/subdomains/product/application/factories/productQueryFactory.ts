import { GetProductByIdQuery } from "../queries/GetProductByIdQuery";
import { GetProductByCodeQuery } from "../queries/GetProductByCodeQuery";
import { GetProductReferencesQuery } from "../queries/GetProductReferencesQuery";
import { SearchProductsQuery } from "../queries/SearchProductsQuery";
import { PrismaProductQueryService } from "../../infrastructure/queries/PrismaProductQueryService";

export function getProductByIdQueryFactory(): GetProductByIdQuery {
  return new GetProductByIdQuery(new PrismaProductQueryService());
}

export function getProductByCodeQueryFactory(): GetProductByCodeQuery {
  return new GetProductByCodeQuery(new PrismaProductQueryService());
}

export function getProductReferencesQueryFactory(): GetProductReferencesQuery {
  return new GetProductReferencesQuery(new PrismaProductQueryService());
}

export function searchProductsQueryFactory(): SearchProductsQuery {
  return new SearchProductsQuery(new PrismaProductQueryService());
}
