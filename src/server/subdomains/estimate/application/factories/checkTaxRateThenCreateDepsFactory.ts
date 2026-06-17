import { TaxRateConsistencyCheckDomainService } from "../../domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";
import { createEstimateCommandFactory } from "./createEstimateCommandFactory";

/**
 * app-shared `checkTaxRateThenCreate`（ADR-0056）に渡す依存の Composition Root。
 *
 * 税率導出＋§8.7 整合チェックの {@link TaxRateConsistencyCheckDomainService}（編集画面と
 * 同じ `findEffectiveAt` を共有）と、純粋な組立器 {@link CreateEstimateCommand} を解決する。
 * 後者はセット検証用に `PrismaProductQueryService` 注入済み（ADR-0052）。
 */
export function checkTaxRateThenCreateDepsFactory() {
  return {
    taxRateConsistencyCheck: new TaxRateConsistencyCheckDomainService(
      new PrismaTaxRateRepository()
    ),
    createCommand: createEstimateCommandFactory(),
  };
}
