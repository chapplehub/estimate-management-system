import { GetEstimateDetailQuery } from "../queries/GetEstimateDetailQuery";
import { PrismaEstimateQueryService } from "../../infrastructure/queries/PrismaEstimateQueryService";

/** 見積詳細取得クエリ（Q1）を組み立てる。読み取りは PrismaEstimateQueryService 実装に閉じる。 */
export function getEstimateDetailQueryFactory(): GetEstimateDetailQuery {
  return new GetEstimateDetailQuery(new PrismaEstimateQueryService());
}
