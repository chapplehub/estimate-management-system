import { Employee } from "@/domain/entities/Employee";
import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@/domain/services/Employee/EmployeeCdDuplicationCheckDomainService";
import { Role } from "@/domain/types/Role";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";
import { NotFoundEntityError } from "@/shared/errors/ApplicationError";
import { ValidationError } from "@/shared/errors/DomainError";
import { IEmployeeQueryService } from "@/domain/queries/IEmployeeQueryService";
import { EmployeeDTO } from "@/domain/queries/dto/EmployeeDTO";
import {
  EmployeeSearchCriteria,
  ListOptions,
} from "@/domain/queries/dto/EmployeeSearchCriteria";

// TODO: これどこに置くか決める。そもそも、各サービスをファイルに分けるか決める。
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
    private readonly employeeQueryService: IEmployeeQueryService,
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

  /**
   * IDで従業員を取得
   */
  async getById(id: string): Promise<EmployeeDTO | null> {
    return await this.employeeQueryService.findById(id);
  }

  /**
   * メールアドレスで従業員を取得
   */
  async getByEmail(email: string): Promise<EmployeeDTO | null> {
    return await this.employeeQueryService.findByEmail(email);
  }

  /**
   * 従業員CDで従業員を取得
   */
  async getByEmployeeCd(employeeCd: string): Promise<EmployeeDTO | null> {
    return await this.employeeQueryService.findByEmployeeCd(employeeCd);
  }

  /**
   * 全従業員を取得
   */
  async getAll(options?: ListOptions): Promise<EmployeeDTO[]> {
    return await this.employeeQueryService.findAll(options);
  }

  /**
   * 検索条件に基づいて従業員を検索
   */
  async search(
    criteria: EmployeeSearchCriteria,
    options?: ListOptions
  ): Promise<EmployeeDTO[]> {
    return await this.employeeQueryService.search(criteria, options);
  }

  /**
   * 検索条件に一致する従業員数をカウント
   */
  async count(criteria: EmployeeSearchCriteria): Promise<number> {
    return await this.employeeQueryService.count(criteria);
  }
}
