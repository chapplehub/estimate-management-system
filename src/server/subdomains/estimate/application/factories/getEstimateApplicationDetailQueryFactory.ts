import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { GetEstimateApplicationDetailQuery } from "../queries/GetEstimateApplicationDetailQuery";
import { PrismaEstimateApplicationDetailQueryService } from "../../infrastructure/queries/PrismaEstimateApplicationDetailQueryService";

/**
 * 見積申請詳細 参照クエリ（#573・ADR-20260707-ae2）の Composition Root。
 *
 * 操作者非依存の読み取り（{@link PrismaEstimateApplicationDetailQueryService}）と、操作可否合成に使う
 * 役割メンバーシップ判定（{@link PrismaRoleQueryService}・role サブドメイン）を app 層 Query に注入する。
 * role の直読みを estimate infra に持ち込まず、越境判定を `hasMember` に閉じ込める点で
 * {@link previewApplicationQueryFactory} と同型（複数サブドメインのクエリを app 層で合成する読み取り）。
 */
export function getEstimateApplicationDetailQueryFactory(): GetEstimateApplicationDetailQuery {
  return new GetEstimateApplicationDetailQuery(
    new PrismaEstimateApplicationDetailQueryService(),
    new PrismaRoleQueryService()
  );
}
