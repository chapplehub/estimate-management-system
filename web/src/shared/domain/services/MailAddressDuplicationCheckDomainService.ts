import { IEmployeeRepository } from "@/subdomains/employee/repositories/IEmployeeRepository";
import { MailAddress } from "@/shared/domain/values/MailAddress";

export class MailAddressDuplicationCheckDomainService {
  constructor(private employeeRepository: IEmployeeRepository) {}

  async execute(mailAddress: MailAddress): Promise<boolean> {
    const duplicatedEmployee = await this.employeeRepository.findByEmail(
      mailAddress
    );
    const isDuplicated = !!duplicatedEmployee;

    return isDuplicated;
  }
}
