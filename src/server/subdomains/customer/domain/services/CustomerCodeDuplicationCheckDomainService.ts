import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CustomerRepository } from "@subdomains/customer/domain/repositories/CustomerRepository";

export class CustomerCodeDuplicationCheckDomainService {
  constructor(private customerRepository: CustomerRepository) {}

  async execute(code: CompanyCode): Promise<boolean> {
    const existing = await this.customerRepository.findByCode(code);
    return !!existing;
  }
}
