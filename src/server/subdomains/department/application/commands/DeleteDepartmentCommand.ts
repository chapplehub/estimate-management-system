import { Department } from "@subdomains/department/domain/entities/Department";
import { DepartmentRepository } from "@subdomains/department/domain/repositories/DepartmentRepository";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";

export type DeleteDepartmentInput = {
  id: string;
};

/**
 * 部署削除コマンド
 *
 * 物理削除を行う。子部署がある場合や従業員が所属している場合は削除できない。
 * 論理削除（無効化）を行う場合は UpdateDepartmentCommand の isActive を使用すること。
 */
export class DeleteDepartmentCommand {
  public constructor(private readonly departmentRepository: DepartmentRepository) {}

  async execute(input: DeleteDepartmentInput): Promise<void> {
    const department = await this.departmentRepository.findById(input.id);
    if (!department) {
      throw new NotFoundEntityError(Department, { id: input.id });
    }

    // 子部署がある場合は削除できない
    const children = await this.departmentRepository.findChildren(input.id);
    if (children.length > 0) {
      throw new BusinessRuleViolationError(
        "子部署が存在するため、この部署を削除できません。先に子部署を削除してください。"
      );
    }

    // NOTE: 従業員が所属している場合の削除制限は、
    // 従業員側のドメインサービスまたはアプリケーションサービスで実装する
    // ここでは部署ドメイン内で完結する制約のみをチェック

    await this.departmentRepository.delete(input.id);
  }
}
