import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationRepository } from "@subdomains/delivery-location/domain/repositories/DeliveryLocationRepository";

export type DeleteDeliveryLocationInput = {
  id: string;
};

/**
 * 納品先削除コマンド
 */
export class DeleteDeliveryLocationCommand {
  constructor(private readonly deliveryLocationRepository: DeliveryLocationRepository) {}

  async execute(input: DeleteDeliveryLocationInput): Promise<void> {
    const deliveryLocation = await this.deliveryLocationRepository.findById(input.id);
    if (!deliveryLocation) {
      throw new NotFoundEntityError(DeliveryLocation, { id: input.id });
    }

    await this.deliveryLocationRepository.delete(input.id);
  }
}
