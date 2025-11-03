import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { MailAddress } from "@/domain/valueObjects/MailAddress";

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
