import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";

export type DeactivateCustomerInput = {
  id: string;
};

/**
 * 得意先無効化コマンド
 */
export class DeactivateCustomerCommand {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(input: DeactivateCustomerInput): Promise<Customer> {
    const customerId = new CustomerId(input.id);
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundEntityError(Customer, { id: input.id });
    }

    customer.deactivate();

    return await this.customerRepository.save(customer);
  }
}
