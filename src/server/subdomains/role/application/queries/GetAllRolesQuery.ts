import { RoleDTO } from "./dto/RoleDTO";
import { RoleListOptions } from "./dto/RoleSearchCriteria";
import { RoleQueryService } from "./RoleQueryService";

export type GetAllRolesInput = {
  options?: RoleListOptions;
};

/**
 * 全役割取得クエリ
 */
export class GetAllRolesQuery {
  public constructor(private readonly roleQueryService: RoleQueryService) {}

  async execute(input: GetAllRolesInput): Promise<RoleDTO[]> {
    return await this.roleQueryService.findAll(input.options);
  }
}
