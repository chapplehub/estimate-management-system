import { DeliveryLocationQueryService } from "./DeliveryLocationQueryService";
import { DeliveryLocationDTO } from "./dto/DeliveryLocationDTO";
import {
  DeliveryLocationSearchCriteria,
  DeliveryLocationListOptions,
} from "./dto/DeliveryLocationSearchCriteria";

export class SearchDeliveryLocationsQuery {
  constructor(private readonly deliveryLocationQueryService: DeliveryLocationQueryService) {}

  async execute(
    criteria: DeliveryLocationSearchCriteria,
    options?: DeliveryLocationListOptions
  ): Promise<DeliveryLocationDTO[]> {
    return await this.deliveryLocationQueryService.search(criteria, options);
  }
}
