import { DeliveryLocationDTO } from "./dto/DeliveryLocationDTO";
import {
  DeliveryLocationSearchCriteria,
  DeliveryLocationListOptions,
} from "./dto/DeliveryLocationSearchCriteria";

/**
 * 納品先クエリサービスインターフェース
 */
export interface DeliveryLocationQueryService {
  findById(id: string): Promise<DeliveryLocationDTO | null>;
  findByCode(code: string): Promise<DeliveryLocationDTO | null>;
  findByCustomerId(
    customerId: string,
    options?: DeliveryLocationListOptions
  ): Promise<DeliveryLocationDTO[]>;
  search(
    criteria: DeliveryLocationSearchCriteria,
    options?: DeliveryLocationListOptions
  ): Promise<DeliveryLocationDTO[]>;
  findAll(options?: DeliveryLocationListOptions): Promise<DeliveryLocationDTO[]>;
  count(criteria: DeliveryLocationSearchCriteria): Promise<number>;
}
