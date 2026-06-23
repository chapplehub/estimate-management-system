import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { PrismaPositionQueryService } from "@subdomains/position/infrastructure/queries/PrismaPositionQueryService";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { PreviewApplicationQuery } from "../queries/PreviewApplicationQuery";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";

/**
 * 申請プレビュークエリ（#417・§6.3）の Composition Root。
 *
 * 「金額→抽象段階」と「組織構造→具体役職」の2問分離（ADR-0062）を解くため、見積本体の
 * リポジトリに加えて 商品／従業員／職位／役割 の各クエリを注入する。クエリ自身は具象実装に
 * 依存せず、ここで Prisma 実装に解決して束ねる。副作用のない読み取り専用（申請行・免除行を作らない）。
 */
export function previewApplicationQueryFactory(): PreviewApplicationQuery {
  return new PreviewApplicationQuery(
    new PrismaEstimateRepository(),
    new PrismaProductQueryService(),
    new PrismaEmployeeQueryService(),
    new PrismaPositionQueryService(),
    new PrismaRoleQueryService()
  );
}
