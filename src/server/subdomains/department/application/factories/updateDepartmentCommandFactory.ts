import { UpdateDepartmentCommand } from "../commands/UpdateDepartmentCommand";
import { PrismaDepartmentRepository } from "../../infrastructure/prisma/PrismaDepartmentRepository";

/**
 * UpdateDepartmentCommand のファクトリ関数
 */
export function updateDepartmentCommandFactory(): UpdateDepartmentCommand {
  const repository = new PrismaDepartmentRepository();

  return new UpdateDepartmentCommand(repository);
}
