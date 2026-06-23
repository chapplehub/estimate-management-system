import { PreviewApplicationQuery } from "../queries/PreviewApplicationQuery";
import { buildApprovalChainLoaderDeps } from "./approvalChainLoaderDepsFactory";

/**
 * 申請プレビュークエリ（#417・§6.3）の Composition Root。
 *
 * 「金額→抽象段階」と「組織構造→具体役職」の2問分離（ADR-0062）を解くため、見積本体の
 * リポジトリに加えて 商品／従業員／職位／役割 の各クエリを注入する。依存の構成は Submit と
 * 共有する {@link buildApprovalChainLoaderDeps} に寄せ、具象解決の重複を避ける。
 * クエリ自身は具象実装に依存せず、副作用のない読み取り専用（申請行・免除行を作らない）。
 */
export function previewApplicationQueryFactory(): PreviewApplicationQuery {
  const deps = buildApprovalChainLoaderDeps();
  return new PreviewApplicationQuery(
    deps.estimateRepository,
    deps.productQueryService,
    deps.employeeQueryService,
    deps.positionQueryService,
    deps.roleQueryService
  );
}
