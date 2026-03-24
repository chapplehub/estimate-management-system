import { EmployeeRepository } from "@subdomains/employee/domain/repositories/EmployeeRepository";
import { MailAddress } from "@server/shared/domain/values/MailAddress";

export class MailAddressDuplicationCheckDomainService {
  constructor(private employeeRepository: EmployeeRepository) {}

  async execute(mailAddress: MailAddress): Promise<boolean> {
    const duplicatedEmployee = await this.employeeRepository.findByEmail(mailAddress);
    const isDuplicated = !!duplicatedEmployee;

    return isDuplicated;
  }
}
