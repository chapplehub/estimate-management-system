import { IEmployeeQueryService } from "@subdomains/employee/application/queries/IEmployeeQueryService";
import { EmployeeSearchCriteria } from "@subdomains/employee/application/queries/dto/EmployeeSearchCriteria";

export type CountEmployeesInput = {
  criteria: EmployeeSearchCriteria;
};

/**
 * 検索条件に一致する従業員数をカウントするクエリ
 */
export class CountEmployeesQuery {
  public constructor(
    private readonly employeeQueryService: IEmployeeQueryService
  ) {}

  async execute(input: CountEmployeesInput): Promise<number> {
    return await this.employeeQueryService.count(input.criteria);
  }
}
