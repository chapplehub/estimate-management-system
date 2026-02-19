import { DeliveryLocationQueryService } from "./DeliveryLocationQueryService";
import { DeliveryLocationDTO } from "./dto/DeliveryLocationDTO";

export type GetDeliveryLocationByIdInput = {
  id: string;
};

export class GetDeliveryLocationByIdQuery {
  constructor(private readonly deliveryLocationQueryService: DeliveryLocationQueryService) {}

  async execute(input: GetDeliveryLocationByIdInput): Promise<DeliveryLocationDTO | null> {
    return await this.deliveryLocationQueryService.findById(input.id);
  }
}
