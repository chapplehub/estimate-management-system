import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleRepository } from "@subdomains/role/domain/repositories/RoleRepository";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";

export type DeleteRoleInput = {
  id: string;
};

/**
 * 役割削除コマンド
 *
 * 下位役割がある場合や使用中の場合は削除できない。
 */
export class DeleteRoleCommand {
  public constructor(private readonly roleRepository: RoleRepository) {}

  async execute(input: DeleteRoleInput): Promise<void> {
    const roleId = new RoleId(input.id);
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundEntityError(Role, { id: input.id });
    }

    // 下位役割がある場合は削除できない
    const subordinates = await this.roleRepository.findSubordinates(roleId);
    if (subordinates.length > 0) {
      throw new BusinessRuleViolationError(
        "下位役割が存在するため、この役割を削除できません。先に下位役割を削除してください。"
      );
    }

    // 使用中の場合は削除できない
    const inUse = await this.roleRepository.isInUse(roleId);
    if (inUse) {
      throw new BusinessRuleViolationError(
        "この役割は従業員に割り当てられているため削除できません。先に割り当てを解除してください。"
      );
    }

    await this.roleRepository.delete(roleId);
  }
}
