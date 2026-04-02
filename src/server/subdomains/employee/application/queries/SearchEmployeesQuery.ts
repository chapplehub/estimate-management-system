import { EmployeeQueryService } from "@subdomains/employee/application/queries/EmployeeQueryService";
import { EmployeeDTO } from "@subdomains/employee/application/queries/dto/EmployeeDTO";
import {
  EmployeeSearchCriteria,
  ListOptions,
} from "@subdomains/employee/application/queries/dto/EmployeeSearchCriteria";

export type SearchEmployeesInput = {
  criteria: EmployeeSearchCriteria;
  options?: ListOptions;
};

/**
 * 検索条件に基づいて従業員を検索するクエリ
 */
export class SearchEmployeesQuery {
  public constructor(private readonly employeeQueryService: EmployeeQueryService) {}

  async execute(input: SearchEmployeesInput): Promise<EmployeeDTO[]> {
    return await this.employeeQueryService.search(input.criteria, input.options);
  }
}
