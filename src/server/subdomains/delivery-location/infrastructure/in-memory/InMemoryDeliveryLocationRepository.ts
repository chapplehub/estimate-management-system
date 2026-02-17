import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { DeliveryLocationRepository } from "@subdomains/delivery-location/domain/repositories/DeliveryLocationRepository";

export class InMemoryDeliveryLocationRepository implements DeliveryLocationRepository {
  public DB: { [id: string]: DeliveryLocation } = {};

  async save(deliveryLocation: DeliveryLocation): Promise<DeliveryLocation> {
    this.DB[deliveryLocation.id] = deliveryLocation;
    return deliveryLocation;
  }

  async delete(id: string): Promise<void> {
    delete this.DB[id];
  }

  async findById(id: string): Promise<DeliveryLocation | null> {
    return this.DB[id] || null;
  }

  async findByCode(code: CompanyCode): Promise<DeliveryLocation | null> {
    const dl = Object.values(this.DB).find((d) => d.code.equals(code));
    return dl || null;
  }
}
