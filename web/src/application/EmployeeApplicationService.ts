import { Employee } from "@/domain/entities/Employee";
import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@/domain/services/Employee/EmployeeCdDuplicationCheckDomainService";
import { Role } from "@/domain/types/Role";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";
import { NotFoundEntityError } from "@/shared/errors/ApplicationError";
import { ValidationError } from "@/shared/errors/DomainError";

// TODO: これどこかほかのところに置きたい
export type RegisterEmployeeCommand = {
  employeeCd: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
};

export type ChangeEmployeeCommand = {
  id: string;
  employeeCd: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
};

export class EmployeeApplicationService {
  public constructor(
    private readonly employeeRepository: IEmployeeRepository,
    private readonly employeeCdDuplicationCheckDomainService: EmployeeCdDuplicationCheckDomainService
  ) {}

  async register(command: RegisterEmployeeCommand): Promise<void> {
    const employeeCd = new EmployeeCd(command.employeeCd);
    const isDuplicated =
      await this.employeeCdDuplicationCheckDomainService.execute(employeeCd);
    if (isDuplicated) {
      throw new ValidationError(`既に存在する従業員CDです: CD=${employeeCd}`);
    }
    const newEmployee = Employee.create(
      employeeCd,
      new MailAddress(command.email),
      command.name,
      command.passwordHash,
      command.role
    );

    await this.employeeRepository.save(newEmployee);
  }

  async change(command: ChangeEmployeeCommand): Promise<void> {
    const targetEmployee = await this.employeeRepository.findById(command.id);
    if (!targetEmployee) {
      throw new NotFoundEntityError(Employee, {
        employeeCd: command.employeeCd,
      });
    }

    targetEmployee.changeName(command.name);
    targetEmployee.changeEmail(new MailAddress(command.email));
    targetEmployee.changeRole(command.role);

    await this.employeeRepository.save(targetEmployee);
  }
}
