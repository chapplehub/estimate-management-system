import { UpdateEmployeeCommand } from "../commands/UpdateEmployeeCommand";
import { MailAddressDuplicationCheckDomainService } from "../../domain/services/MailAddressDuplicationCheckDomainService";
import { PrismaEmployeeRepository } from "../../infrastructure/prisma/PrismaEmployeeRepository";

/**
 * UpdateEmployeeCommand のファクトリ関数
 *
 * Composition Root として機能し、インフラ層への依存を解決する。
 */
export function updateEmployeeCommandFactory(): UpdateEmployeeCommand {
  const repository = new PrismaEmployeeRepository();

  return new UpdateEmployeeCommand(
    repository,
    new MailAddressDuplicationCheckDomainService(repository)
  );
}
