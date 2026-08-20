import { UpdateRoleCommand } from "../commands/UpdateRoleCommand";
import { RoleNameDuplicationCheckDomainService } from "../../domain/services/RoleNameDuplicationCheckDomainService";
import { SuperiorRoleValidationDomainService } from "../../domain/services/SuperiorRoleValidationDomainService";
import { PrismaRoleRepository } from "../../infrastructure/prisma/PrismaRoleRepository";
import { PrismaPositionRepository } from "../../infrastructure/prisma/PrismaPositionRepository";

/**
 * UpdateRoleCommand のファクトリ関数
 */
export function updateRoleCommandFactory(): UpdateRoleCommand {
  const roleRepository = new PrismaRoleRepository();
  const positionRepository = new PrismaPositionRepository();

  return new UpdateRoleCommand(
    roleRepository,
    new RoleNameDuplicationCheckDomainService(roleRepository),
    new SuperiorRoleValidationDomainService(roleRepository, positionRepository)
  );
}
