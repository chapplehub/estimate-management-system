import { resolveSellingPriceQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import { ReviseForCustomerCommand } from "../commands/ReviseForCustomerCommand";
import { TaxRateConsistencyCheckDomainService } from "../../domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";

/**
 * ReviseForCustomerCommand（C7）の Composition Root。
 *
 * 改訂先明細の見積単価を権威解決する価格決定（#428・#431）を注入する。
 */
export function reviseForCustomerCommandFactory(): ReviseForCustomerCommand {
  const repository = new PrismaEstimateRepository();
  const taxRateConsistencyCheck = new TaxRateConsistencyCheckDomainService(
    new PrismaTaxRateRepository()
  );
  return new ReviseForCustomerCommand(
    repository,
    taxRateConsistencyCheck,
    resolveSellingPriceQueryFactory()
  );
}
