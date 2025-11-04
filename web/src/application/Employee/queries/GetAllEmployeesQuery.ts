import { IEmployeeQueryService } from "@/domain/queries/IEmployeeQueryService";
import { EmployeeDTO } from "@/domain/queries/dto/EmployeeDTO";
import { ListOptions } from "@/domain/queries/dto/EmployeeSearchCriteria";

export type GetAllEmployeesInput = {
  options?: ListOptions;
};

/**
 * 全従業員を取得するクエリ
 */
export class GetAllEmployeesQuery {
  public constructor(
    private readonly employeeQueryService: IEmployeeQueryService
  ) {}

  async execute(input: GetAllEmployeesInput): Promise<EmployeeDTO[]> {
    return await this.employeeQueryService.findAll(input.options);
  }
}
