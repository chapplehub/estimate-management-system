import { UpdateEstimateCommand } from "../commands/UpdateEstimateCommand";
import { TaxRateConsistencyCheckDomainService } from "../../domain/services/TaxRateConsistencyCheckDomainService";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";
import { PrismaTaxRateRepository } from "../../infrastructure/prisma/PrismaTaxRateRepository";

/**
 * UpdateEstimateCommand（C2）の Composition Root。
 *
 * ドメインインターフェース（EstimateRepository / TaxRateRepository）に対する Prisma
 * 実装を解決し、税率チェック横断サービスへ注入してコマンドを組み立てる。
 */
export function updateEstimateCommandFactory(): UpdateEstimateCommand {
  const repository = new PrismaEstimateRepository();
  const taxRateConsistencyCheck = new TaxRateConsistencyCheckDomainService(
    new PrismaTaxRateRepository()
  );
  return new UpdateEstimateCommand(repository, taxRateConsistencyCheck);
}
