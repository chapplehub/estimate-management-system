import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";

export type ActivateCustomerInput = {
  id: string;
  /** 一覧・詳細の有効化ボタン表示時の version（楽観ロックトークン / ADR-0039）。 */
  expectedVersion: number;
};

/**
 * 得意先有効化コマンド
 */
export class ActivateCustomerCommand {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(input: ActivateCustomerInput): Promise<Customer> {
    const customerId = new CustomerId(input.id);
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundEntityError(Customer, { id: input.id });
    }

    customer.activate();

    return await this.customerRepository.update(customer, input.expectedVersion);
  }
}
