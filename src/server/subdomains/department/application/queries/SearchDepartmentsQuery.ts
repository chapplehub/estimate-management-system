import { DepartmentDTO } from "./dto/DepartmentDTO";
import {
  DepartmentSearchCriteria,
  DepartmentListOptions,
} from "./dto/DepartmentSearchCriteria";
import { IDepartmentQueryService } from "./IDepartmentQueryService";

export type SearchDepartmentsInput = {
  criteria: DepartmentSearchCriteria;
  options?: DepartmentListOptions;
};

/**
 * 部署検索クエリ
 */
export class SearchDepartmentsQuery {
  public constructor(
    private readonly departmentQueryService: IDepartmentQueryService
  ) {}

  async execute(input: SearchDepartmentsInput): Promise<DepartmentDTO[]> {
    return await this.departmentQueryService.search(
      input.criteria,
      input.options
    );
  }
}
