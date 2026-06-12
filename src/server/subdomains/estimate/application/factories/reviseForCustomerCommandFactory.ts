import { ReviseForCustomerCommand } from "../commands/ReviseForCustomerCommand";
import { TaxRateConsistencyCheckDomainService } from "../../domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";

/**
 * ReviseForCustomerCommand（C7）の Composition Root。
 */
export function reviseForCustomerCommandFactory(): ReviseForCustomerCommand {
  const repository = new PrismaEstimateRepository();
  const taxRateConsistencyCheck = new TaxRateConsistencyCheckDomainService(
    new PrismaTaxRateRepository()
  );
  return new ReviseForCustomerCommand(repository, taxRateConsistencyCheck);
}
