import { CustomerQueryService } from "./CustomerQueryService";
import { CustomerDTO } from "./dto/CustomerDTO";
import { CustomerListOptions } from "./dto/CustomerSearchCriteria";

export class GetAllCustomersQuery {
  constructor(private readonly customerQueryService: CustomerQueryService) {}

  async execute(options?: CustomerListOptions): Promise<CustomerDTO[]> {
    return await this.customerQueryService.findAll(options);
  }
}
