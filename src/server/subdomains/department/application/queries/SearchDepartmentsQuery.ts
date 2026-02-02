import { DepartmentDTO } from "./dto/DepartmentDTO";
import { DepartmentSearchCriteria, DepartmentListOptions } from "./dto/DepartmentSearchCriteria";
import { DepartmentQueryService } from "./DepartmentQueryService";

export type SearchDepartmentsInput = {
  criteria: DepartmentSearchCriteria;
  options?: DepartmentListOptions;
};

/**
 * 部署検索クエリ
 */
export class SearchDepartmentsQuery {
  public constructor(private readonly departmentQueryService: DepartmentQueryService) {}

  async execute(input: SearchDepartmentsInput): Promise<DepartmentDTO[]> {
    return await this.departmentQueryService.search(input.criteria, input.options);
  }
}
