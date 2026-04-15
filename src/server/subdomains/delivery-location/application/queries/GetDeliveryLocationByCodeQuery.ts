import { DeliveryLocationQueryService } from "./DeliveryLocationQueryService";
import { DeliveryLocationDTO } from "./dto/DeliveryLocationDTO";

export type GetDeliveryLocationByCodeInput = {
  code: string;
};

export class GetDeliveryLocationByCodeQuery {
  constructor(private readonly deliveryLocationQueryService: DeliveryLocationQueryService) {}

  async execute(input: GetDeliveryLocationByCodeInput): Promise<DeliveryLocationDTO | null> {
    return await this.deliveryLocationQueryService.findByCode(input.code);
  }
}
