import { DeleteEmployeeCommand } from "../commands/DeleteEmployeeCommand";
import { PrismaEmployeeRepository } from "../../infrastructure/prisma/PrismaEmployeeRepository";

/**
 * DeleteEmployeeCommand のファクトリ関数
 *
 * Composition Root として機能し、インフラ層への依存を解決する。
 */
export function deleteEmployeeCommandFactory(): DeleteEmployeeCommand {
  const repository = new PrismaEmployeeRepository();

  return new DeleteEmployeeCommand(repository);
}
