import { DepartmentDTO } from "./dto/DepartmentDTO";
import { IDepartmentQueryService } from "./IDepartmentQueryService";

export type GetDepartmentByIdInput = {
  id: string;
};

/**
 * ID指定部署取得クエリ
 */
export class GetDepartmentByIdQuery {
  public constructor(
    private readonly departmentQueryService: IDepartmentQueryService
  ) {}

  async execute(input: GetDepartmentByIdInput): Promise<DepartmentDTO | null> {
    return await this.departmentQueryService.findById(input.id);
  }
}
