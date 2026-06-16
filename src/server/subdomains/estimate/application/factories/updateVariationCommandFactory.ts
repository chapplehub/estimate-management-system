import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { UpdateVariationCommand } from "../commands/UpdateVariationCommand";
import { TaxRateConsistencyCheckDomainService } from "../../domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";

/**
 * UpdateVariationCommand（C4）の Composition Root。
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
    new PrismaProductQueryService()
  );
}
