import { DepartmentDTO } from "./dto/DepartmentDTO";
import { DepartmentListOptions } from "./dto/DepartmentSearchCriteria";
import { IDepartmentQueryService } from "./IDepartmentQueryService";

export type GetActiveDepartmentsInput = {
  options?: DepartmentListOptions;
};

/**
 * 有効な部署のみ取得クエリ
 */
export class GetActiveDepartmentsQuery {
  public constructor(private readonly departmentQueryService: IDepartmentQueryService) {}

  async execute(input: GetActiveDepartmentsInput): Promise<DepartmentDTO[]> {
    return await this.departmentQueryService.findActive(input.options);
  }
}
