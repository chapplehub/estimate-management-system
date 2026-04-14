import { CustomerQueryService } from "./CustomerQueryService";
import { CustomerDTO } from "./dto/CustomerDTO";

export type GetCustomerByCodeInput = {
  code: string;
};

export class GetCustomerByCodeQuery {
  constructor(private readonly customerQueryService: CustomerQueryService) {}

  async execute(input: GetCustomerByCodeInput): Promise<CustomerDTO | null> {
    return await this.customerQueryService.findByCode(input.code);
  }
}
