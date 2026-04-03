import { GetAllRolesQuery } from "../queries/GetAllRolesQuery";
import { GetRoleByIdQuery } from "../queries/GetRoleByIdQuery";
import { GetRoleByRoleCdQuery } from "../queries/GetRoleByRoleCdQuery";
import { GetRolesByPositionQuery } from "../queries/GetRolesByPositionQuery";
import { SearchRolesQuery } from "../queries/SearchRolesQuery";
import { PrismaRoleQueryService } from "../../infrastructure/queries/PrismaRoleQueryService";

/**
 * 役割クエリ関連のファクトリ関数
 */

export function getAllRolesQueryFactory(): GetAllRolesQuery {
  const queryService = new PrismaRoleQueryService();
  return new GetAllRolesQuery(queryService);
}

export function getRoleByIdQueryFactory(): GetRoleByIdQuery {
  const queryService = new PrismaRoleQueryService();
  return new GetRoleByIdQuery(queryService);
}

export function searchRolesQueryFactory(): SearchRolesQuery {
  const queryService = new PrismaRoleQueryService();
  return new SearchRolesQuery(queryService);
}

export function getRoleByRoleCdQueryFactory(): GetRoleByRoleCdQuery {
  const queryService = new PrismaRoleQueryService();
  return new GetRoleByRoleCdQuery(queryService);
}

export function getRolesByPositionQueryFactory(): GetRolesByPositionQuery {
  const queryService = new PrismaRoleQueryService();
  return new GetRolesByPositionQuery(queryService);
}
