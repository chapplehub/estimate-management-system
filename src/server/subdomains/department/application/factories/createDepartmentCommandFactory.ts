import { CreateDepartmentCommand } from "../commands/CreateDepartmentCommand";
import { DepartmentCdDuplicationCheckDomainService } from "../../domain/services/DepartmentCdDuplicationCheckDomainService";
import { PrismaDepartmentRepository } from "../../infrastructure/prisma/PrismaDepartmentRepository";

/**
 * CreateDepartmentCommand のファクトリ関数
 *
 * Composition Root として機能し、インフラ層への依存を解決する。
 * Presentation 層（Server Actions）からはこのファクトリを呼び出すことで、
 * インフラ層への直接依存を避ける。
 */
export function createDepartmentCommandFactory(): CreateDepartmentCommand {
  const repository = new PrismaDepartmentRepository();

  return new CreateDepartmentCommand(
    repository,
    new DepartmentCdDuplicationCheckDomainService(repository)
  );
}
