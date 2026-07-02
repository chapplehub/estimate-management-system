import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { RejectStepCommand } from "../commands/RejectStepCommand";
import { PrismaEstimateApplicationRepository } from "../../infrastructure/prisma/approval/PrismaEstimateApplicationRepository";

/**
 * RejectStepCommand（ステップ差戻・§7.2）の Composition Root。
 *
 * 承認と同じく差戻者の役割メンバーシップ検証（§7.4）に役割クエリを要するため、申請リポジトリと
 * RoleQueryService を注入する（approveStepCommandFactory と同型）。原子性は repo.update 内の
 * runAtomically が担保するため TransactionRunner は要さない。
 */
export function rejectStepCommandFactory(): RejectStepCommand {
  return new RejectStepCommand(
    new PrismaEstimateApplicationRepository(),
    new PrismaRoleQueryService()
  );
}
