import { Employee } from "@/subdomains/employee/entities/Employee";
import { IEmployeeRepository } from "@/subdomains/employee/repositories/IEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@/subdomains/employee/services/EmployeeCdDuplicationCheckDomainService";
import { Role } from "@/subdomains/employee/types/Role";
import { EmployeeCd } from "@/subdomains/employee/values/EmployeeCd";
import { MailAddress } from "@/shared/domain/values/MailAddress";
import { ValidationError } from "@/shared/errors/DomainError";

export type CreateEmployeeInput = {
  employeeCd: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
};

/**
 * 従業員新規登録コマンド
 */
export class CreateEmployeeCommand {
  public constructor(
    private readonly employeeRepository: IEmployeeRepository,
    private readonly employeeCdDuplicationCheckDomainService: EmployeeCdDuplicationCheckDomainService
  ) {}

  async execute(input: CreateEmployeeInput): Promise<void> {
    const employeeCd = new EmployeeCd(input.employeeCd);
    const isDuplicated =
      await this.employeeCdDuplicationCheckDomainService.execute(employeeCd);
    if (isDuplicated) {
      throw new ValidationError(`既に存在する従業員CDです: CD=${employeeCd}`);
    }
    const newEmployee = Employee.create(
      employeeCd,
      new MailAddress(input.email),
      input.name,
      input.passwordHash,
      input.role
    );

    await this.employeeRepository.save(newEmployee);
  }
}
