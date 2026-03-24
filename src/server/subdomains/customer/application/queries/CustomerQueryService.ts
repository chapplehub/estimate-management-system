import { CustomerDTO } from "./dto/CustomerDTO";
import { CustomerSearchCriteria, CustomerListOptions } from "./dto/CustomerSearchCriteria";

/**
 * 得意先クエリサービスインターフェース
 */
export interface CustomerQueryService {
  findById(id: string): Promise<CustomerDTO | null>;
  findByCode(code: string): Promise<CustomerDTO | null>;
  search(criteria: CustomerSearchCriteria, options?: CustomerListOptions): Promise<CustomerDTO[]>;
  findAll(options?: CustomerListOptions): Promise<CustomerDTO[]>;
  count(criteria: CustomerSearchCriteria): Promise<number>;
}
