import { Employee } from "@/domain/entities/Employee";
import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { EmployeeDuplicationCheckDomainService } from "@/domain/services/Employee/EmployeeDuplicationCheckDomainService";
import { Role } from "@/domain/types/Role";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";
import { ValidationError } from "@/shared/errors/DomainError";

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
    private readonly employeeDuplicationCheckDomainService: EmployeeDuplicationCheckDomainService
  ) {}

  async register(command: RegisterEmployeeCommand): Promise<void> {
    const employeeCd = new EmployeeCd(command.employeeCd);
    const isDuplicated =
      await this.employeeDuplicationCheckDomainService.execute(employeeCd);
    if (isDuplicated) {
      throw new ValidationError("既に存在する雇用者CDです");
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
      throw new Error(`雇用者が存在しません", ${command.employeeCd}`);
    }

    targetEmployee.changeName(command.name);
    targetEmployee.changeEmail(new MailAddress(command.email));
    targetEmployee.changeRole(command.role);

    await this.employeeRepository.save(targetEmployee);
  }
}
