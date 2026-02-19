import { CustomerQueryService } from "./CustomerQueryService";
import { CustomerDTO } from "./dto/CustomerDTO";

export type GetCustomerByIdInput = {
  id: string;
};

export class GetCustomerByIdQuery {
  constructor(private readonly customerQueryService: CustomerQueryService) {}

  async execute(input: GetCustomerByIdInput): Promise<CustomerDTO | null> {
    return await this.customerQueryService.findById(input.id);
  }
}
