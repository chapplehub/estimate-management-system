import { DeleteRoleCommand } from "../commands/DeleteRoleCommand";
import { PrismaRoleRepository } from "../../infrastructure/prisma/PrismaRoleRepository";

/**
 * DeleteRoleCommand のファクトリ関数
 */
export function deleteRoleCommandFactory(): DeleteRoleCommand {
  const repository = new PrismaRoleRepository();

  return new DeleteRoleCommand(repository);
}
