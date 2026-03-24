import { DepartmentTreeDTO } from "./dto/DepartmentDTO";
import { DepartmentQueryService } from "./DepartmentQueryService";

export type GetDepartmentTreeInput = {
  rootId?: string | null;
};

/**
 * 部署ツリー取得クエリ
 */
export class GetDepartmentTreeQuery {
  public constructor(private readonly departmentQueryService: DepartmentQueryService) {}

  async execute(input: GetDepartmentTreeInput): Promise<DepartmentTreeDTO[]> {
    return await this.departmentQueryService.getTree(input.rootId);
  }
}
