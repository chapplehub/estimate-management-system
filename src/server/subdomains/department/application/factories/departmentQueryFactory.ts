import { GetAllDepartmentsQuery } from "../queries/GetAllDepartmentsQuery";
import { GetDepartmentByIdQuery } from "../queries/GetDepartmentByIdQuery";
import { SearchDepartmentsQuery } from "../queries/SearchDepartmentsQuery";
import { GetDepartmentTreeQuery } from "../queries/GetDepartmentTreeQuery";
import { GetActiveDepartmentsQuery } from "../queries/GetActiveDepartmentsQuery";
import { PrismaDepartmentQueryService } from "../../infrastructure/queries/PrismaDepartmentQueryService";

/**
 * 部署クエリ関連のファクトリ関数
 */

export function getAllDepartmentsQueryFactory(): GetAllDepartmentsQuery {
  const queryService = new PrismaDepartmentQueryService();
  return new GetAllDepartmentsQuery(queryService);
}

export function getDepartmentByIdQueryFactory(): GetDepartmentByIdQuery {
  const queryService = new PrismaDepartmentQueryService();
  return new GetDepartmentByIdQuery(queryService);
}

export function searchDepartmentsQueryFactory(): SearchDepartmentsQuery {
  const queryService = new PrismaDepartmentQueryService();
  return new SearchDepartmentsQuery(queryService);
}

export function getDepartmentTreeQueryFactory(): GetDepartmentTreeQuery {
  const queryService = new PrismaDepartmentQueryService();
  return new GetDepartmentTreeQuery(queryService);
}

export function getActiveDepartmentsQueryFactory(): GetActiveDepartmentsQuery {
  const queryService = new PrismaDepartmentQueryService();
  return new GetActiveDepartmentsQuery(queryService);
}
