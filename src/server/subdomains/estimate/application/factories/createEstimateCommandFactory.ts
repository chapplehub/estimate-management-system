import { CreateEstimateCommand } from "../commands/CreateEstimateCommand";
import { PrismaEstimateNumberIssuer } from "../../infrastructure/prisma/PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";

/**
 * CreateEstimateCommand の Composition Root。
 *
 * ドメインインターフェース（EstimateRepository / EstimateNumberIssuer）に対する
 * Prisma 実装を解決して注入する。コマンド自身は具象実装に依存しない。
 */
export function createEstimateCommandFactory(): CreateEstimateCommand {
  const repository = new PrismaEstimateRepository();
  const numberIssuer = new PrismaEstimateNumberIssuer();
  return new CreateEstimateCommand(repository, numberIssuer);
}
