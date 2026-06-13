import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";

export type DeleteCustomerInput = {
  id: string;
  /** 削除画面表示時の version（楽観ロックトークン / ADR-0039）。リポジトリへ素通しする。 */
  expectedVersion: number;
};

/**
 * 得意先削除コマンド
 */
export class DeleteCustomerCommand {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(input: DeleteCustomerInput): Promise<void> {
    const customerId = new CustomerId(input.id);
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundEntityError(Customer, { id: input.id });
    }

    await this.customerRepository.delete(customerId, input.expectedVersion);
  }
}
