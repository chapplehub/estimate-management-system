import { resolveSellingPriceQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import { AddVariationCommand } from "../commands/AddVariationCommand";
import { TaxRateConsistencyCheckDomainService } from "../../domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";

/**
 * AddVariationCommand（C3）の Composition Root。
 *
 * 明細生成時の見積単価を権威解決する価格決定（#428・ADR-0064）を注入する。
 */
export function addVariationCommandFactory(): AddVariationCommand {
  const repository = new PrismaEstimateRepository();
  const taxRateConsistencyCheck = new TaxRateConsistencyCheckDomainService(
    new PrismaTaxRateRepository()
  );
  return new AddVariationCommand(
    repository,
    taxRateConsistencyCheck,
    resolveSellingPriceQueryFactory()
  );
}
