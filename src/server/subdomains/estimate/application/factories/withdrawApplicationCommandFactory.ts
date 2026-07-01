import { WithdrawApplicationCommand } from "../commands/WithdrawApplicationCommand";
import { PrismaEstimateApplicationRepository } from "../../infrastructure/prisma/approval/PrismaEstimateApplicationRepository";

/**
 * WithdrawApplicationCommand（申請取下・§7.3）の Composition Root。
 *
 * 単一集約 EstimateApplication の更新1回で完結し、権限（申請者本人）判定材料も集約内に
 * 完結するため、申請リポジトリのみを注入する最小構成。承認/差戻と異なり役割グラフの
 * クエリも TransactionRunner も要さない。
 */
export function withdrawApplicationCommandFactory(): WithdrawApplicationCommand {
  return new WithdrawApplicationCommand(new PrismaEstimateApplicationRepository());
}
