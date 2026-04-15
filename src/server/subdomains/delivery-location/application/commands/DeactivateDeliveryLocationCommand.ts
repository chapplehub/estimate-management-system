import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationRepository } from "@subdomains/delivery-location/domain/repositories/DeliveryLocationRepository";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";

export type DeactivateDeliveryLocationInput = {
  id: string;
};

/**
 * 納品先無効化コマンド
 */
export class DeactivateDeliveryLocationCommand {
  constructor(private readonly deliveryLocationRepository: DeliveryLocationRepository) {}

  async execute(input: DeactivateDeliveryLocationInput): Promise<DeliveryLocation> {
    const deliveryLocationId = new DeliveryLocationId(input.id);
    const deliveryLocation = await this.deliveryLocationRepository.findById(deliveryLocationId);
    if (!deliveryLocation) {
      throw new NotFoundEntityError(DeliveryLocation, { id: input.id });
    }

    deliveryLocation.deactivate();

    return await this.deliveryLocationRepository.save(deliveryLocation);
  }
}
