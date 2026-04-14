import { GetCustomerByIdQuery } from "../queries/GetCustomerByIdQuery";
import { GetCustomerByCodeQuery } from "../queries/GetCustomerByCodeQuery";
import { SearchCustomersQuery } from "../queries/SearchCustomersQuery";
import { PrismaCustomerQueryService } from "../../infrastructure/queries/PrismaCustomerQueryService";

export function getCustomerByIdQueryFactory(): GetCustomerByIdQuery {
  return new GetCustomerByIdQuery(new PrismaCustomerQueryService());
}

export function getCustomerByCodeQueryFactory(): GetCustomerByCodeQuery {
  return new GetCustomerByCodeQuery(new PrismaCustomerQueryService());
}

export function searchCustomersQueryFactory(): SearchCustomersQuery {
  return new SearchCustomersQuery(new PrismaCustomerQueryService());
}
