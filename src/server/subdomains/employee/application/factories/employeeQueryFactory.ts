import { GetEmployeeByIdQuery } from "../queries/GetEmployeeByIdQuery";
import { PrismaEmployeeQueryService } from "../../infrastructure/queries/PrismaEmployeeQueryService";

/** ID で従業員を取得するクエリの Composition Root。 */
export function getEmployeeByIdQueryFactory(): GetEmployeeByIdQuery {
  return new GetEmployeeByIdQuery(new PrismaEmployeeQueryService());
}
