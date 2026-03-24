import { DepartmentDTO } from "./dto/DepartmentDTO";
import { DepartmentQueryService } from "./DepartmentQueryService";

export type GetDepartmentByIdInput = {
  id: string;
};

/**
 * ID指定部署取得クエリ
 */
export class GetDepartmentByIdQuery {
  public constructor(private readonly departmentQueryService: DepartmentQueryService) {}

  async execute(input: GetDepartmentByIdInput): Promise<DepartmentDTO | null> {
    return await this.departmentQueryService.findById(input.id);
  }
}
