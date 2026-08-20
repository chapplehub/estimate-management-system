import { GetAllPositionsQuery } from "../queries/GetAllPositionsQuery";
import { GetPositionByIdQuery } from "../queries/GetPositionByIdQuery";
import { PrismaPositionQueryService } from "../../infrastructure/queries/PrismaPositionQueryService";

export function getAllPositionsQueryFactory(): GetAllPositionsQuery {
  const queryService = new PrismaPositionQueryService();
  return new GetAllPositionsQuery(queryService);
}

export function getPositionByIdQueryFactory(): GetPositionByIdQuery {
  const queryService = new PrismaPositionQueryService();
  return new GetPositionByIdQuery(queryService);
}
