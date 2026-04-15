import { Address } from "@server/shared/domain/values/Address";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { MarginRate } from "@subdomains/customer/domain/values/MarginRate";

export type UpdateCustomerInput = {
  id: string;
  name: string;
  postalCode?: string | null;
  prefecture?: string | null;
  address?: string | null;
  phoneNumber?: string | null;
  faxNumber?: string | null;
  contactPerson?: string | null;
  marginRate?: number | null;
};

/**
 * 得意先情報変更コマンド
 *
 * コード（code）は変更不可。
 */
export class UpdateCustomerCommand {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async execute(input: UpdateCustomerInput): Promise<void> {
    const customerId = new CustomerId(input.id);
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundEntityError(Customer, { id: input.id });
    }

    customer.changeName(new CompanyName(input.name));

    customer.changeAddress(
      input.postalCode ? new PostalCode(input.postalCode) : null,
      input.prefecture ? new Prefecture(input.prefecture) : null,
      input.address ? new Address(input.address) : null
    );

    customer.changeContactInfo(
      input.phoneNumber ? new PhoneNumber(input.phoneNumber) : null,
      input.faxNumber ? new FaxNumber(input.faxNumber) : null,
      input.contactPerson ?? null
    );

    customer.changeMarginRate(
      input.marginRate !== undefined && input.marginRate !== null
        ? new MarginRate(input.marginRate)
        : null
    );

    await this.customerRepository.save(customer);
  }
}
