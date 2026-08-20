import { CreateRoleCommand } from "../commands/CreateRoleCommand";
import { RoleCdDuplicationCheckDomainService } from "../../domain/services/RoleCdDuplicationCheckDomainService";
import { RoleNameDuplicationCheckDomainService } from "../../domain/services/RoleNameDuplicationCheckDomainService";
import { SuperiorRoleValidationDomainService } from "../../domain/services/SuperiorRoleValidationDomainService";
import { PrismaRoleRepository } from "../../infrastructure/prisma/PrismaRoleRepository";
import { PrismaPositionRepository } from "../../infrastructure/prisma/PrismaPositionRepository";

/**
 * CreateRoleCommand のファクトリ関数
 *
 * 5つの依存を解決する Composition Root:
 * - RoleRepository (save, findByRoleCd, findByName)
 * - PositionRepository (exists - 役職存在確認)
 * - RoleCdDuplicationCheckDomainService
 * - RoleNameDuplicationCheckDomainService
 * - SuperiorRoleValidationDomainService (上位役割の役職レベルチェック)
 */
export function createRoleCommandFactory(): CreateRoleCommand {
  const roleRepository = new PrismaRoleRepository();
  const positionRepository = new PrismaPositionRepository();

  return new CreateRoleCommand(
    roleRepository,
    positionRepository,
    new RoleCdDuplicationCheckDomainService(roleRepository),
    new RoleNameDuplicationCheckDomainService(roleRepository),
    new SuperiorRoleValidationDomainService(roleRepository, positionRepository)
  );
}
