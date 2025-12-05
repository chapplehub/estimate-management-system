import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { IEmployeeRepository } from "@subdomains/employee/domain/repositories/IEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@subdomains/employee/domain/services/EmployeeCdDuplicationCheckDomainService";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { Role } from "@subdomains/employee/domain/types/Role";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { ValidationError } from "@server/shared/errors/DomainError";

export type CreateEmployeeInput = {
  employeeCd: string;
  email: string;
  name: string;
  role: Role;
};

/**
 * 従業員新規登録コマンド
 */
export class CreateEmployeeCommand {
  public constructor(
    private readonly employeeRepository: IEmployeeRepository,
    private readonly employeeCdDuplicationCheckDomainService: EmployeeCdDuplicationCheckDomainService,
    private readonly mailAddressDuplicationCheckDomainService: MailAddressDuplicationCheckDomainService
  ) {}

  async execute(input: CreateEmployeeInput): Promise<void> {
    const employeeCd = new EmployeeCd(input.employeeCd);
    const mailAddress = new MailAddress(input.email);

    // 従業員コードの重複チェック
    const isCdDuplicated =
      await this.employeeCdDuplicationCheckDomainService.execute(employeeCd);
    if (isCdDuplicated) {
      throw new ValidationError(`既に存在する従業員CDです: CD=${employeeCd}`);
    }

    // メールアドレスの重複チェック
    const isEmailDuplicated =
      await this.mailAddressDuplicationCheckDomainService.execute(mailAddress);
    if (isEmailDuplicated) {
      throw new ValidationError(
        `既に存在するメールアドレスです: Email=${mailAddress.value}`
      );
    }

    const newEmployee = Employee.create(
      employeeCd,
      mailAddress,
      input.name,
      input.role
    );

    await this.employeeRepository.save(newEmployee);
  }
}
