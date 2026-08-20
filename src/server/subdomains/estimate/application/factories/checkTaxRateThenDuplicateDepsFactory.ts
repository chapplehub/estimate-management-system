import { TaxRateConsistencyCheckDomainService } from "../../domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";
import { duplicateEstimateCommandFactory } from "./duplicateEstimateCommandFactory";

/**
 * app-shared `checkTaxRateThenDuplicate`（ADR-0056/0057）に渡す依存の Composition Root。
 *
 * 税率導出＋§8.7 整合チェックの {@link TaxRateConsistencyCheckDomainService}（編集・作成画面と
 * 同じ `findEffectiveAt` を共有）と、複製集約・系譜を生成する {@link DuplicateEstimateCommand}
 * を解決する。後者は複製元ロード→保存時採番→insertWithCopies を担う（ADR-0040）。
 */
export function checkTaxRateThenDuplicateDepsFactory() {
  return {
    taxRateConsistencyCheck: new TaxRateConsistencyCheckDomainService(
      new PrismaTaxRateRepository()
    ),
    duplicateCommand: duplicateEstimateCommandFactory(),
  };
}
