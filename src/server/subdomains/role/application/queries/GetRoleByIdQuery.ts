import { RoleDTO } from "./dto/RoleDTO";
import { RoleQueryService } from "./RoleQueryService";

export type GetRoleByIdInput = {
  id: string;
};

/**
 * ID指定役割取得クエリ
 */
export class GetRoleByIdQuery {
  public constructor(private readonly roleQueryService: RoleQueryService) {}

  async execute(input: GetRoleByIdInput): Promise<RoleDTO | null> {
    return await this.roleQueryService.findById(input.id);
  }
}
