import { BetterAuthUserManagementService } from "@server/shared/auth/better-auth/BetterAuthUserManagementService";
import { CreateEmployeeCommand } from "../commands/CreateEmployeeCommand";
import { EmployeeCdDuplicationCheckDomainService } from "../../domain/services/EmployeeCdDuplicationCheckDomainService";
import { MailAddressDuplicationCheckDomainService } from "../../domain/services/MailAddressDuplicationCheckDomainService";
import { PrismaEmployeeRepository } from "../../infrastructure/prisma/PrismaEmployeeRepository";

/**
 * CreateEmployeeCommand のファクトリ関数
 *
 * Composition Root として機能し、インフラ層への依存を解決する。
 * Presentation 層（Server Actions）からはこのファクトリを呼び出すことで、
 * インフラ層への直接依存を避ける。
 */
export function createEmployeeCommandFactory(): CreateEmployeeCommand {
  const repository = new PrismaEmployeeRepository();
  const userManagementService = new BetterAuthUserManagementService();

  return new CreateEmployeeCommand(
    repository,
    new EmployeeCdDuplicationCheckDomainService(repository),
    new MailAddressDuplicationCheckDomainService(repository),
    userManagementService
  );
}
