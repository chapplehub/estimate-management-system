import { ActivateVariationCommand } from "../commands/ActivateVariationCommand";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";

/**
 * ActivateVariationCommand（バリエーション有効化・S7/C5）の Composition Root。
 *
 * 有効化は税額に影響せず進行ロックのガードも持たない（ADR-0061）ため、税率関連の依存も
 * 商品クエリも注入しない最小構成（updateVariationMemosCommandFactory と同型）。
 */
export function activateVariationCommandFactory(): ActivateVariationCommand {
  return new ActivateVariationCommand(new PrismaEstimateRepository());
}
