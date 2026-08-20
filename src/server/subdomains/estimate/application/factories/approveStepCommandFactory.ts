import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { ApproveStepCommand } from "../commands/ApproveStepCommand";
import { PrismaEstimateApplicationRepository } from "../../infrastructure/prisma/approval/PrismaEstimateApplicationRepository";

/**
 * ApproveStepCommand（ステップ承認・§7.1）の Composition Root。
 *
 * 単一集約 EstimateApplication の更新に加え、承認者の役割メンバーシップ検証（§7.4）に
 * 役割クエリを要するため、申請リポジトリと RoleQueryService を注入する。原子性は
 * repo.update 内の runAtomically が担保するため TransactionRunner は要さない。
 */
export function approveStepCommandFactory(): ApproveStepCommand {
  return new ApproveStepCommand(
    new PrismaEstimateApplicationRepository(),
    new PrismaRoleQueryService()
  );
}
