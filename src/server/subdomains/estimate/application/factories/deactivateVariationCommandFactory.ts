import { DeactivateVariationCommand } from "../commands/DeactivateVariationCommand";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";

/**
 * DeactivateVariationCommand（バリエーション無効化・S7/C5）の Composition Root。
 *
 * 無効化は税額に影響しない素の version 保存のため税率関連の依存も商品クエリも注入しない。
 * 進行ロックの拡張点は現状 no-op（ADR-0061・案 X）で、申請テーブルの read model が揃った
 * 時点で EstimateApplicationStatusQueryService（仮）をここで注入して接続する。
 */
export function deactivateVariationCommandFactory(): DeactivateVariationCommand {
  return new DeactivateVariationCommand(new PrismaEstimateRepository());
}
