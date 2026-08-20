import { UpdateVariationMemosCommand } from "../commands/UpdateVariationMemosCommand";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";

/**
 * UpdateVariationMemosCommand（改訂元のメモのみ更新・ADR-0059）の Composition Root。
 *
 * メモ更新は税率整合チェックを通さない素の version 保存のため、税率関連の依存
 * （TaxRateConsistencyCheckDomainService）も商品クエリ（セット検証）も注入しない。
 */
export function updateVariationMemosCommandFactory(): UpdateVariationMemosCommand {
  return new UpdateVariationMemosCommand(new PrismaEstimateRepository());
}
