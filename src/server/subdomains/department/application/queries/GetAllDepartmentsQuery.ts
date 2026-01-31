import { DepartmentDTO } from "./dto/DepartmentDTO";
import { DepartmentListOptions } from "./dto/DepartmentSearchCriteria";
import { IDepartmentQueryService } from "./IDepartmentQueryService";

export type GetAllDepartmentsInput = {
  options?: DepartmentListOptions;
};

/**
 * 全部署取得クエリ
 */
export class GetAllDepartmentsQuery {
  public constructor(private readonly departmentQueryService: IDepartmentQueryService) {}

  async execute(input: GetAllDepartmentsInput): Promise<DepartmentDTO[]> {
    return await this.departmentQueryService.findAll(input.options);
  }
}
