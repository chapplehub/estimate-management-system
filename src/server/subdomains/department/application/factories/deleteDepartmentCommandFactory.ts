import { DeleteDepartmentCommand } from "../commands/DeleteDepartmentCommand";
import { PrismaDepartmentRepository } from "../../infrastructure/prisma/PrismaDepartmentRepository";

/**
 * DeleteDepartmentCommand のファクトリ関数
 */
export function deleteDepartmentCommandFactory(): DeleteDepartmentCommand {
  const repository = new PrismaDepartmentRepository();

  return new DeleteDepartmentCommand(repository);
}
