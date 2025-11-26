import { MailAddress } from "@/shared/domain/values/MailAddress";
import { MailAddressDuplicationCheckDomainService } from "@/shared/domain/services/MailAddressDuplicationCheckDomainService";
import { NotFoundEntityError } from "@/shared/errors/ApplicationError";
import { ValidationError } from "@/shared/errors/DomainError";
import { Employee } from "@/subdomains/employee/entities/Employee";
import { IEmployeeRepository } from "@/subdomains/employee/repositories/IEmployeeRepository";
import { Role } from "@/subdomains/employee/types/Role";

export type UpdateEmployeeInput = {
  id: string;
  employeeCd: string;
  email: string;
  name: string;
  // passwordHash: string;
  role: Role;
};

/**
 * 従業員情報変更コマンド
 */
export class UpdateEmployeeCommand {
  public constructor(
    private readonly employeeRepository: IEmployeeRepository,
    private readonly mailAddressDuplicationCheckDomainService: MailAddressDuplicationCheckDomainService
  ) {}

  async execute(input: UpdateEmployeeInput): Promise<void> {
    const targetEmployee = await this.employeeRepository.findById(input.id);
    if (!targetEmployee) {
      throw new NotFoundEntityError(Employee, {
        employeeCd: input.employeeCd,
      });
    }

    const newMailAddress = new MailAddress(input.email);

    // メールアドレスが変更される場合のみ重複チェック
    if (!targetEmployee.email.equals(newMailAddress)) {
      const isDuplicated =
        await this.mailAddressDuplicationCheckDomainService.execute(
          newMailAddress
        );
      if (isDuplicated) {
        throw new ValidationError(
          `既に存在するメールアドレスです: Email=${newMailAddress.value}`
        );
      }
    }

    targetEmployee.changeName(input.name);
    targetEmployee.changeEmail(newMailAddress);
    targetEmployee.changeRole(input.role);

    await this.employeeRepository.save(targetEmployee);
  }
}
