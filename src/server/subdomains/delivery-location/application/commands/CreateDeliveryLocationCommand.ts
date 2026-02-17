import { Address } from "@server/shared/domain/values/Address";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { ValidationError } from "@server/shared/errors/DomainError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationRepository } from "@subdomains/delivery-location/domain/repositories/DeliveryLocationRepository";
import { DeliveryLocationCodeDuplicationCheckDomainService } from "@subdomains/delivery-location/domain/services/DeliveryLocationCodeDuplicationCheckDomainService";
import { DeliveryNotes } from "@subdomains/delivery-location/domain/values/DeliveryNotes";

export type CreateDeliveryLocationInput = {
  code: string;
  name: string;
  customerId: string;
  postalCode?: string;
  prefecture?: string;
  address?: string;
  phoneNumber?: string;
  faxNumber?: string;
  contactPerson?: string;
  deliveryNotes?: string;
};

/**
 * 納品先新規登録コマンド
 */
export class CreateDeliveryLocationCommand {
  constructor(
    private readonly deliveryLocationRepository: DeliveryLocationRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly deliveryLocationCodeDuplicationCheckDomainService: DeliveryLocationCodeDuplicationCheckDomainService
  ) {}

  async execute(input: CreateDeliveryLocationInput): Promise<void> {
    // 親得意先の存在チェック
    const customer = await this.customerRepository.findById(input.customerId);
    if (!customer) {
      throw new NotFoundEntityError(Customer, { id: input.customerId });
    }

    if (!customer.isActive) {
      throw new ValidationError("無効化された得意先には納品先を追加できません");
    }

    const code = new CompanyCode(input.code);

    const isDuplicated = await this.deliveryLocationCodeDuplicationCheckDomainService.execute(code);
    if (isDuplicated) {
      throw new ValidationError(`既に存在する取引先コードです: コード=${code.value}`);
    }

    const deliveryLocation = DeliveryLocation.create(
      code,
      new CompanyName(input.name),
      input.customerId,
      {
        postalCode: input.postalCode ? new PostalCode(input.postalCode) : undefined,
        prefecture: input.prefecture ? new Prefecture(input.prefecture) : undefined,
        address: input.address ? new Address(input.address) : undefined,
        phoneNumber: input.phoneNumber ? new PhoneNumber(input.phoneNumber) : undefined,
        faxNumber: input.faxNumber ? new FaxNumber(input.faxNumber) : undefined,
        contactPerson: input.contactPerson,
        deliveryNotes: input.deliveryNotes ? new DeliveryNotes(input.deliveryNotes) : undefined,
      }
    );

    await this.deliveryLocationRepository.save(deliveryLocation);
  }
}
