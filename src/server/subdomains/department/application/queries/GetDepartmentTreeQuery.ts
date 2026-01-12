import { DepartmentTreeDTO } from "./dto/DepartmentDTO";
import { IDepartmentQueryService } from "./IDepartmentQueryService";

export type GetDepartmentTreeInput = {
  rootId?: string | null;
};

/**
 * 部署ツリー取得クエリ
 */
export class GetDepartmentTreeQuery {
  public constructor(
    private readonly departmentQueryService: IDepartmentQueryService
  ) {}

  async execute(input: GetDepartmentTreeInput): Promise<DepartmentTreeDTO[]> {
    return await this.departmentQueryService.getTree(input.rootId);
  }
}
