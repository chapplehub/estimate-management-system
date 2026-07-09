import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { resolveSellingPriceQueryFactory } from "@subdomains/pricing/application/factories/pricingQueryFactory";
import { UpdateVariationCommand } from "../commands/UpdateVariationCommand";
import { TaxRateConsistencyCheckDomainService } from "../../domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";

/**
 * UpdateVariationCommand（C4）の Composition Root。
 *
 * 明細生成時の見積単価を権威解決する価格決定（#428・ADR-0064）を注入する。
 */
export function updateVariationCommandFactory(): UpdateVariationCommand {
  const repository = new PrismaEstimateRepository();
  const taxRateConsistencyCheck = new TaxRateConsistencyCheckDomainService(
    new PrismaTaxRateRepository()
  );
  // セット構成のライブ区分・有効性検証（ADR-0052）に商品クエリを注入する。
  return new UpdateVariationCommand(
    repository,
    taxRateConsistencyCheck,
    new PrismaProductQueryService(),
    resolveSellingPriceQueryFactory()
  );
}
