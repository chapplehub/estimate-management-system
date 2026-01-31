import { IEmployeeQueryService } from "@subdomains/employee/application/queries/IEmployeeQueryService";
import { EmployeeDTO } from "@subdomains/employee/application/queries/dto/EmployeeDTO";

export type GetEmployeeByEmployeeCdInput = {
  employeeCd: string;
};

/**
 * 従業員CDで従業員を取得するクエリ
 */
export class GetEmployeeByEmployeeCdQuery {
  public constructor(private readonly employeeQueryService: IEmployeeQueryService) {}

  async execute(input: GetEmployeeByEmployeeCdInput): Promise<EmployeeDTO | null> {
    return await this.employeeQueryService.findByEmployeeCd(input.employeeCd);
  }
}
