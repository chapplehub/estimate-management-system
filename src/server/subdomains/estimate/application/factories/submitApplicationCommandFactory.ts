import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { PrismaPositionQueryService } from "@subdomains/position/infrastructure/queries/PrismaPositionQueryService";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { SubmitApplicationCommand } from "../commands/SubmitApplicationCommand";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";
import { PrismaEstimateApplicationRepository } from "../../infrastructure/prisma/approval/PrismaEstimateApplicationRepository";
import { PrismaEstimateApprovalExemptionRepository } from "../../infrastructure/prisma/approval/PrismaEstimateApprovalExemptionRepository";

/**
 * 見積申請コマンド（#417・ADR-0066）の Composition Root。
 *
 * version 関門で「1見積1前進」を直列化するため、見積本体・申請・免除の3リポジトリと、
 * 承認チェーン組立てに要する 商品／従業員／職位／役割 のクエリを解決して注入する。
 * コマンド自身はドメインインターフェースにのみ依存し、Prisma 具象はここに閉じる。
 */
export function submitApplicationCommandFactory(): SubmitApplicationCommand {
  return new SubmitApplicationCommand(
    new PrismaEstimateRepository(),
    new PrismaEstimateApplicationRepository(),
    new PrismaEstimateApprovalExemptionRepository(),
    new PrismaProductQueryService(),
    new PrismaEmployeeQueryService(),
    new PrismaPositionQueryService(),
    new PrismaRoleQueryService()
  );
}
