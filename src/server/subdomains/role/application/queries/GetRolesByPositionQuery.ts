import { RoleDTO } from "./dto/RoleDTO";
import { RoleListOptions } from "./dto/RoleSearchCriteria";
import { RoleQueryService } from "./RoleQueryService";

export type GetRolesByPositionInput = {
  positionId: string;
  options?: RoleListOptions;
};

/**
 * 役職別役割取得クエリ
 */
export class GetRolesByPositionQuery {
  public constructor(private readonly roleQueryService: RoleQueryService) {}

  async execute(input: GetRolesByPositionInput): Promise<RoleDTO[]> {
    return await this.roleQueryService.findByPositionId(input.positionId, input.options);
  }
}
