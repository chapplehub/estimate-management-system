import { RoleDTO } from "./dto/RoleDTO";
import { RoleQueryService } from "./RoleQueryService";

export type GetRoleByRoleCdInput = {
  roleCd: string;
};

/**
 * 役割コード指定役割取得クエリ
 */
export class GetRoleByRoleCdQuery {
  public constructor(private readonly roleQueryService: RoleQueryService) {}

  async execute(input: GetRoleByRoleCdInput): Promise<RoleDTO | null> {
    return await this.roleQueryService.findByRoleCd(input.roleCd);
  }
}
