import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { CreateEstimateCommand } from "../commands/CreateEstimateCommand";
import { PrismaEstimateNumberIssuer } from "../../infrastructure/prisma/PrismaEstimateNumberIssuer";
import { PrismaEstimateRepository } from "../../infrastructure/prisma/PrismaEstimateRepository";

/**
 * CreateEstimateCommand の Composition Root。
 *
 * ドメインインターフェース（EstimateRepository / EstimateNumberIssuer）に対する
 * Prisma 実装を解決して注入する。コマンド自身は具象実装に依存しない。
 *
 * セット構成のライブ区分・有効性検証（ADR-0052）に商品クエリを注入する。C4 と同型で、
 * 作成画面（#351）から渡るセット群ペイロードを防御する。
 */
export function createEstimateCommandFactory(): CreateEstimateCommand {
  const repository = new PrismaEstimateRepository();
  const numberIssuer = new PrismaEstimateNumberIssuer();
  return new CreateEstimateCommand(repository, numberIssuer, new PrismaProductQueryService());
}
