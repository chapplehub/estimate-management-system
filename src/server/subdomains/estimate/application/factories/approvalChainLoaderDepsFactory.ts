import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { PrismaPositionQueryService } from "@subdomains/position/infrastructure/queries/PrismaPositionQueryService";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { type ApprovalChainInputLoaderDeps } from "../shared/approval/loadApprovalChainInputs";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";

/**
 * 承認チェーン越境ローダーの依存（{@link ApprovalChainInputLoaderDeps}）を Prisma 実装で組む共有ファクトリ。
 *
 * Preview（クエリ）と Submit（コマンド）はローダーを共有し、その依存（見積リポジトリ＋
 * 商品/従業員/職位/役割クエリ）も同一構成になる。各ファクトリで `new PrismaXxx()` を重複させると
 * 構成のドリフト源になるため、ここに一元化する。Submit 固有の申請／免除リポジトリは各ファクトリ側で足す。
 */
export function buildApprovalChainLoaderDeps(): ApprovalChainInputLoaderDeps {
  return {
    estimateRepository: new PrismaEstimateRepository(),
    productQueryService: new PrismaProductQueryService(),
    employeeQueryService: new PrismaEmployeeQueryService(),
    positionQueryService: new PrismaPositionQueryService(),
    roleQueryService: new PrismaRoleQueryService(),
  };
}
