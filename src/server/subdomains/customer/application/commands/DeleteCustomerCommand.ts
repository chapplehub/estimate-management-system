import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";

export type DeleteCustomerInput = {
  id: string;
};

/**
 * 得意先削除コマンド
 */
export class DeleteCustomerCommand {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(input: DeleteCustomerInput): Promise<void> {
    const customer = await this.customerRepository.findById(input.id);
    if (!customer) {
      throw new NotFoundEntityError(Customer, { id: input.id });
    }

    await this.customerRepository.delete(input.id);
  }
}
