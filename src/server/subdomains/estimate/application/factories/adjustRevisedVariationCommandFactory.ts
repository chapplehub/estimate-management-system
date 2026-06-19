import { AdjustRevisedVariationCommand } from "../commands/AdjustRevisedVariationCommand";
import { TaxRateConsistencyCheckDomainService } from "../../domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";

/**
 * AdjustRevisedVariationCommand（#390・改訂先の部分編集）の Composition Root。
 *
 * 価格変更で税額が動くため税率整合チェック（§8.6/§8.7）を通す（C4 と同じ依存）。
 * セット群は触らない（行構成固定）ため商品クエリ（セット検証）は注入しない。
 */
export function adjustRevisedVariationCommandFactory(): AdjustRevisedVariationCommand {
  const repository = new PrismaEstimateRepository();
  const taxRateConsistencyCheck = new TaxRateConsistencyCheckDomainService(
    new PrismaTaxRateRepository()
  );
  return new AdjustRevisedVariationCommand(repository, taxRateConsistencyCheck);
}
