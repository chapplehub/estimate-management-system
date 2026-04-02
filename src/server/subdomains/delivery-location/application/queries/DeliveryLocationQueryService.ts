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
  search(
    criteria: DeliveryLocationSearchCriteria,
    options?: DeliveryLocationListOptions
  ): Promise<DeliveryLocationDTO[]>;
}
