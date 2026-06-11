import { Address } from "@server/shared/domain/values/Address";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { FaxNumber } from "@server/shared/domain/values/FaxNumber";
import { PhoneNumber } from "@server/shared/domain/values/PhoneNumber";
import { PostalCode } from "@server/shared/domain/values/PostalCode";
import { Prefecture } from "@server/shared/domain/values/Prefecture";
import { ValidationError } from "@server/shared/errors/DomainError";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";
import { CustomerCodeDuplicationCheckDomainService } from "@subdomains/customer/domain/services/CustomerCodeDuplicationCheckDomainService";
import { MarginRate } from "@subdomains/customer/domain/values/MarginRate";

export type CreateCustomerInput = {
  code: string;
  name: string;
  postalCode?: string;
  prefecture?: string;
  address?: string;
  phoneNumber?: string;
  faxNumber?: string;
  contactPerson?: string;
  marginRate?: number;
};

/**
 * 得意先新規登録コマンド
 */
export class CreateCustomerCommand {
  constructor(
    private readonly customerRepository: CustomerRepository,
    private readonly customerCodeDuplicationCheckDomainService: CustomerCodeDuplicationCheckDomainService
  ) {}

  async execute(input: CreateCustomerInput): Promise<void> {
    const code = new CompanyCode(input.code);

    const isDuplicated = await this.customerCodeDuplicationCheckDomainService.execute(code);
    if (isDuplicated) {
      throw new ValidationError(`既に存在する取引先コードです: コード=${code.value}`);
    }

    const customer = Customer.create(code, new CompanyName(input.name), {
      postalCode: input.postalCode ? new PostalCode(input.postalCode) : undefined,
      prefecture: input.prefecture ? new Prefecture(input.prefecture) : undefined,
      address: input.address ? new Address(input.address) : undefined,
      phoneNumber: input.phoneNumber ? new PhoneNumber(input.phoneNumber) : undefined,
      faxNumber: input.faxNumber ? new FaxNumber(input.faxNumber) : undefined,
      contactPerson: input.contactPerson,
      marginRate: input.marginRate !== undefined ? new MarginRate(input.marginRate) : undefined,
    });

    await this.customerRepository.insert(customer);
  }
}
