import { BetterAuthUserManagementService } from "@server/shared/auth/better-auth/BetterAuthUserManagementService";
import { SuperiorRoleKachouTierValidationDomainService } from "@subdomains/role/domain/services/SuperiorRoleKachouTierValidationDomainService";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaPositionRepository } from "@subdomains/role/infrastructure/prisma/PrismaPositionRepository";
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
  const userManagementService = new BetterAuthUserManagementService();

  return new UpdateEmployeeCommand(
    repository,
    new MailAddressDuplicationCheckDomainService(repository),
    userManagementService,
    new SuperiorRoleKachouTierValidationDomainService(
      new PrismaRoleRepository(),
      new PrismaPositionRepository()
    )
  );
}
