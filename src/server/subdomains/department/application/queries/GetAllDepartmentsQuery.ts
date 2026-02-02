import { DepartmentDTO } from "./dto/DepartmentDTO";
import { DepartmentListOptions } from "./dto/DepartmentSearchCriteria";
import { DepartmentQueryService } from "./DepartmentQueryService";

export type GetAllDepartmentsInput = {
  options?: DepartmentListOptions;
};

/**
 * 全部署取得クエリ
 */
export class GetAllDepartmentsQuery {
  public constructor(private readonly departmentQueryService: DepartmentQueryService) {}

  async execute(input: GetAllDepartmentsInput): Promise<DepartmentDTO[]> {
    return await this.departmentQueryService.findAll(input.options);
  }
}
