import { Address } from "@server/shared/domain/values/Address";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationRepository } from "@subdomains/delivery-location/domain/repositories/DeliveryLocationRepository";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DeliveryNotes } from "@subdomains/delivery-location/domain/values/DeliveryNotes";

export type UpdateDeliveryLocationInput = {
  id: string;
  name: string;
  postalCode?: string | null;
  prefecture?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  faxNumber?: string | null;
  contactPerson?: string | null;
  deliveryNotes?: string | null;
};

/**
 * 納品先情報変更コマンド
 *
 * コード（code）と親得意先（customerId）は変更不可。
 */
export class UpdateDeliveryLocationCommand {
  constructor(private readonly deliveryLocationRepository: DeliveryLocationRepository) {}

  async execute(input: UpdateDeliveryLocationInput): Promise<void> {
    const deliveryLocationId = new DeliveryLocationId(input.id);
    const deliveryLocation = await this.deliveryLocationRepository.findById(deliveryLocationId);
    if (!deliveryLocation) {
      throw new NotFoundEntityError(DeliveryLocation, { id: input.id });
    }

    deliveryLocation.changeName(new CompanyName(input.name));

    deliveryLocation.changeAddress(
      input.postalCode ? new PostalCode(input.postalCode) : null,
      input.prefecture ? new Prefecture(input.prefecture) : null,
      input.address ? new Address(input.address) : null
    );

    deliveryLocation.changeContactInfo(
      input.phoneNumber ? new PhoneNumber(input.phoneNumber) : null,
      input.faxNumber ? new FaxNumber(input.faxNumber) : null,
      input.contactPerson ?? null
    );

    deliveryLocation.changeDeliveryNotes(
      input.deliveryNotes ? new DeliveryNotes(input.deliveryNotes) : null
    );

    await this.deliveryLocationRepository.save(deliveryLocation);
  }
}
