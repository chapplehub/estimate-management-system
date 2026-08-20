import { CustomerQueryService } from "./CustomerQueryService";
import { CustomerDTO } from "./dto/CustomerDTO";
import { CustomerSearchCriteria, CustomerListOptions } from "./dto/CustomerSearchCriteria";

export class SearchCustomersQuery {
  constructor(private readonly customerQueryService: CustomerQueryService) {}

  async execute(
    criteria: CustomerSearchCriteria,
    options?: CustomerListOptions
  ): Promise<CustomerDTO[]> {
    return await this.customerQueryService.search(criteria, options);
  }
}
