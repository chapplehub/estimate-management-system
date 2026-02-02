import { DepartmentDTO } from "./dto/DepartmentDTO";
import { DepartmentListOptions } from "./dto/DepartmentSearchCriteria";
import { DepartmentQueryService } from "./DepartmentQueryService";

export type GetActiveDepartmentsInput = {
  options?: DepartmentListOptions;
};

/**
 * 有効な部署のみ取得クエリ
 */
export class GetActiveDepartmentsQuery {
  public constructor(private readonly departmentQueryService: DepartmentQueryService) {}

  async execute(input: GetActiveDepartmentsInput): Promise<DepartmentDTO[]> {
    return await this.departmentQueryService.findActive(input.options);
  }
}
