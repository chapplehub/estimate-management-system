import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationRepository } from "@subdomains/delivery-location/domain/repositories/DeliveryLocationRepository";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";

export type DeleteDeliveryLocationInput = {
  id: string;
};

/**
 * 納品先削除コマンド
 */
export class DeleteDeliveryLocationCommand {
  constructor(private readonly deliveryLocationRepository: DeliveryLocationRepository) {}

  async execute(input: DeleteDeliveryLocationInput): Promise<void> {
    const deliveryLocationId = new DeliveryLocationId(input.id);
    const deliveryLocation = await this.deliveryLocationRepository.findById(deliveryLocationId);
    if (!deliveryLocation) {
      throw new NotFoundEntityError(DeliveryLocation, { id: input.id });
    }

    await this.deliveryLocationRepository.delete(deliveryLocationId);
  }
}
