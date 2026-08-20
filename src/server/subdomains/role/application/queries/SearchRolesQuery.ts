import { RoleDTO } from "./dto/RoleDTO";
import { RoleSearchCriteria, RoleListOptions } from "./dto/RoleSearchCriteria";
import { RoleQueryService } from "./RoleQueryService";

export type SearchRolesInput = {
  criteria: RoleSearchCriteria;
  options?: RoleListOptions;
};

/**
 * 役割検索クエリ
 */
export class SearchRolesQuery {
  public constructor(private readonly roleQueryService: RoleQueryService) {}

  async execute(input: SearchRolesInput): Promise<RoleDTO[]> {
    return await this.roleQueryService.search(input.criteria, input.options);
  }
}
