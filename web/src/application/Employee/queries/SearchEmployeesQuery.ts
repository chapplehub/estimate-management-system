import { IEmployeeQueryService } from "@/domain/queries/IEmployeeQueryService";
import { EmployeeDTO } from "@/domain/queries/dto/EmployeeDTO";
import {
  EmployeeSearchCriteria,
  ListOptions,
} from "@/domain/queries/dto/EmployeeSearchCriteria";

export type SearchEmployeesInput = {
  criteria: EmployeeSearchCriteria;
  options?: ListOptions;
};

/**
 * 検索条件に基づいて従業員を検索するクエリ
 */
export class SearchEmployeesQuery {
  public constructor(
    private readonly employeeQueryService: IEmployeeQueryService
  ) {}

  async execute(input: SearchEmployeesInput): Promise<EmployeeDTO[]> {
    return await this.employeeQueryService.search(
      input.criteria,
      input.options
    );
  }
}
