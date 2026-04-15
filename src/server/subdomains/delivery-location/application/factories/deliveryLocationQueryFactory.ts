import { GetDeliveryLocationByIdQuery } from "../queries/GetDeliveryLocationByIdQuery";
import { GetDeliveryLocationByCodeQuery } from "../queries/GetDeliveryLocationByCodeQuery";
import { SearchDeliveryLocationsQuery } from "../queries/SearchDeliveryLocationsQuery";
import { PrismaDeliveryLocationQueryService } from "../../infrastructure/queries/PrismaDeliveryLocationQueryService";

export function getDeliveryLocationByIdQueryFactory(): GetDeliveryLocationByIdQuery {
  return new GetDeliveryLocationByIdQuery(new PrismaDeliveryLocationQueryService());
}

export function getDeliveryLocationByCodeQueryFactory(): GetDeliveryLocationByCodeQuery {
  return new GetDeliveryLocationByCodeQuery(new PrismaDeliveryLocationQueryService());
}

export function searchDeliveryLocationsQueryFactory(): SearchDeliveryLocationsQuery {
  return new SearchDeliveryLocationsQuery(new PrismaDeliveryLocationQueryService());
}
