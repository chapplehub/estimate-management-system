import { PrismaTransactionRunner } from "@server/shared/infrastructure/transaction/PrismaTransactionRunner";
import { SubmitApplicationCommand } from "../commands/SubmitApplicationCommand";
import { buildApprovalChainLoaderDeps } from "./approvalChainLoaderDepsFactory";
import { PrismaEstimateApplicationRepository } from "../../infrastructure/prisma/approval/PrismaEstimateApplicationRepository";
import { PrismaEstimateApprovalExemptionRepository } from "../../infrastructure/prisma/approval/PrismaEstimateApprovalExemptionRepository";

/**
 * 見積申請コマンド（#417・ADR-0068）の Composition Root。
 *
 * version 関門で「1見積1前進」を直列化するため、見積本体・申請・免除の3リポジトリと、
 * 承認チェーン組立てに要する 商品／従業員／職位／役割 のクエリを解決して注入する。
 * 見積リポジトリ＋組織系クエリは Preview と共有する {@link buildApprovalChainLoaderDeps} から取り、
 * 申請／免除リポジトリだけを本コマンド固有に足す。version 関門と挿入を原子化する atomic submit
 * （ADR-20260626-dee）のため {@link PrismaTransactionRunner} も注入する。コマンド自身はアプリ層ポート
 * （TransactionRunner）とドメインインターフェースにのみ依存する。
 */
export function submitApplicationCommandFactory(): SubmitApplicationCommand {
  const deps = buildApprovalChainLoaderDeps();
  return new SubmitApplicationCommand(
    deps.estimateRepository,
    new PrismaEstimateApplicationRepository(),
    new PrismaEstimateApprovalExemptionRepository(),
    deps.productQueryService,
    deps.employeeQueryService,
    deps.positionQueryService,
    deps.roleQueryService,
    new PrismaTransactionRunner()
  );
}
