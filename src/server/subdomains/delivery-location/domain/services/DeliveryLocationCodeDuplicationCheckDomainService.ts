import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { DeliveryLocationRepository } from "@subdomains/delivery-location/domain/repositories/DeliveryLocationRepository";

export class DeliveryLocationCodeDuplicationCheckDomainService {
  constructor(private deliveryLocationRepository: DeliveryLocationRepository) {}

  async execute(code: CompanyCode): Promise<boolean> {
    const existing = await this.deliveryLocationRepository.findByCode(code);
    return !!existing;
  }
}
