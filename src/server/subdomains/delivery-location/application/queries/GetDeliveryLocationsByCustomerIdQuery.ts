import { DeliveryLocationQueryService } from "./DeliveryLocationQueryService";
import { DeliveryLocationDTO } from "./dto/DeliveryLocationDTO";
import { DeliveryLocationListOptions } from "./dto/DeliveryLocationSearchCriteria";

export type GetDeliveryLocationsByCustomerIdInput = {
  customerId: string;
};

export class GetDeliveryLocationsByCustomerIdQuery {
  constructor(private readonly deliveryLocationQueryService: DeliveryLocationQueryService) {}

  async execute(
    input: GetDeliveryLocationsByCustomerIdInput,
    options?: DeliveryLocationListOptions
  ): Promise<DeliveryLocationDTO[]> {
    return await this.deliveryLocationQueryService.findByCustomerId(input.customerId, options);
  }
}
