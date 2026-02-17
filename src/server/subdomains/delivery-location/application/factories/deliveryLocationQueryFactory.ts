import { GetDeliveryLocationByIdQuery } from "../queries/GetDeliveryLocationByIdQuery";
import { GetDeliveryLocationsByCustomerIdQuery } from "../queries/GetDeliveryLocationsByCustomerIdQuery";
import { SearchDeliveryLocationsQuery } from "../queries/SearchDeliveryLocationsQuery";
import { PrismaDeliveryLocationQueryService } from "../../infrastructure/queries/PrismaDeliveryLocationQueryService";

export function getDeliveryLocationByIdQueryFactory(): GetDeliveryLocationByIdQuery {
  return new GetDeliveryLocationByIdQuery(new PrismaDeliveryLocationQueryService());
}

export function getDeliveryLocationsByCustomerIdQueryFactory(): GetDeliveryLocationsByCustomerIdQuery {
  return new GetDeliveryLocationsByCustomerIdQuery(new PrismaDeliveryLocationQueryService());
}

export function searchDeliveryLocationsQueryFactory(): SearchDeliveryLocationsQuery {
  return new SearchDeliveryLocationsQuery(new PrismaDeliveryLocationQueryService());
}
