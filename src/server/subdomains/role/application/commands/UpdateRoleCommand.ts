import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleRepository } from "@subdomains/role/domain/repositories/RoleRepository";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { RoleNameDuplicationCheckDomainService } from "@subdomains/role/domain/services/RoleNameDuplicationCheckDomainService";
import { SuperiorRoleValidationDomainService } from "@subdomains/role/domain/services/SuperiorRoleValidationDomainService";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { ValidationError } from "@server/shared/errors/DomainError";

export type UpdateRoleInput = {
  id: string;
  name?: string;
  superiorRoleId?: string | null;
};

/**
 * 役割更新コマンド
 *
 * positionId, roleCd は変更不可。
 */
export class UpdateRoleCommand {
  public constructor(
    private readonly roleRepository: RoleRepository,
    private readonly roleNameDuplicationCheckDomainService: RoleNameDuplicationCheckDomainService,
    private readonly superiorRoleValidationDomainService: SuperiorRoleValidationDomainService
  ) {}

  async execute(input: UpdateRoleInput): Promise<Role> {
    const roleId = new RoleId(input.id);
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundEntityError(Role, { id: input.id });
    }

    // 役割名の更新
    if (input.name !== undefined) {
      const isNameDuplicated = await this.roleNameDuplicationCheckDomainService.execute(
        input.name,
        role.id
      );
      if (isNameDuplicated) {
        throw new ValidationError(`既に存在する役割名です: ${input.name}`);
      }
      role.changeName(new RoleName(input.name));
    }

    // 上位役割の更新
    if (input.superiorRoleId !== undefined) {
      const newSuperiorRoleId =
        input.superiorRoleId !== null ? new RoleId(input.superiorRoleId) : null;
      if (newSuperiorRoleId !== null) {
        // 上位役割バリデーション
        await this.superiorRoleValidationDomainService.execute(role.positionId, newSuperiorRoleId);
        // 循環参照チェック
        await this.validateNoCircularReference(role.id, newSuperiorRoleId);
      }
      role.changeSuperiorRole(newSuperiorRoleId);
    }

    return await this.roleRepository.save(role);
  }

  /**
   * 循環参照がないことを検証
   * 指定した上位役割が、自分自身または自分の下位役割でないことを確認
   *
   * 注: 現在の役職階層（課長 < 部長 < 本部長 < 社長）では、
   * SuperiorRoleValidationDomainService の役職レベルチェックにより
   * 祖先チェーンの循環は構造的に発生しない。
   * 自己参照チェックと祖先走査は防御的プログラミングとして残す。
   */
  private async validateNoCircularReference(
    roleId: RoleId,
    newSuperiorRoleId: RoleId
  ): Promise<void> {
    if (roleId.equals(newSuperiorRoleId)) {
      throw new BusinessRuleViolationError("自分自身を上位役割にすることはできません");
    }

    // 新しい上位役割の祖先を辿って、自分自身がいないことを確認
    let currentSuperiorId: RoleId | null = newSuperiorRoleId;
    while (currentSuperiorId !== null) {
      const superiorRole = await this.roleRepository.findById(currentSuperiorId);
      if (!superiorRole) {
        break;
      }
      currentSuperiorId = superiorRole.superiorRoleId;
      if (currentSuperiorId !== null && currentSuperiorId.equals(roleId)) {
        throw new BusinessRuleViolationError(
          "循環参照が発生するため、この上位役割は設定できません"
        );
      }
    }
  }
}
