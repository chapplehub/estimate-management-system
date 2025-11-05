import { Employee } from "@/subdomains/employee/entities/Employee";
import { IEmployeeRepository } from "@/subdomains/employee/repositories/IEmployeeRepository";
import { Role } from "@/subdomains/employee/types/Role";
import { MailAddress } from "@/shared/domain/values/MailAddress";
import { NotFoundEntityError } from "@/shared/errors/ApplicationError";

export type UpdateEmployeeInput = {
  id: string;
  employeeCd: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
};

/**
 * 従業員情報変更コマンド
 */
export class UpdateEmployeeCommand {
  public constructor(
    private readonly employeeRepository: IEmployeeRepository
  ) {}

  async execute(input: UpdateEmployeeInput): Promise<void> {
    const targetEmployee = await this.employeeRepository.findById(input.id);
    if (!targetEmployee) {
      throw new NotFoundEntityError(Employee, {
        employeeCd: input.employeeCd,
      });
    }

    targetEmployee.changeName(input.name);
    targetEmployee.changeEmail(new MailAddress(input.email));
    targetEmployee.changeRole(input.role);

    await this.employeeRepository.save(targetEmployee);
  }
}
