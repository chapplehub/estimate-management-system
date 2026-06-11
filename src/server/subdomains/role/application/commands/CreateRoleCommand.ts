import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleRepository } from "@subdomains/role/domain/repositories/RoleRepository";
import { PositionRepository } from "@subdomains/role/domain/repositories/PositionRepository";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { RoleCdDuplicationCheckDomainService } from "@subdomains/role/domain/services/RoleCdDuplicationCheckDomainService";
import { RoleNameDuplicationCheckDomainService } from "@subdomains/role/domain/services/RoleNameDuplicationCheckDomainService";
import { SuperiorRoleValidationDomainService } from "@subdomains/role/domain/services/SuperiorRoleValidationDomainService";
import { ValidationError } from "@server/shared/errors/DomainError";

export type CreateRoleInput = {
  roleCd: string;
  name: string;
  positionId: string;
  superiorRoleId?: string | null;
};

/**
 * 役割作成コマンド
 */
export class CreateRoleCommand {
  public constructor(
    private readonly roleRepository: RoleRepository,
    private readonly positionRepository: PositionRepository,
    private readonly roleCdDuplicationCheckDomainService: RoleCdDuplicationCheckDomainService,
    private readonly roleNameDuplicationCheckDomainService: RoleNameDuplicationCheckDomainService,
    private readonly superiorRoleValidationDomainService: SuperiorRoleValidationDomainService
  ) {}

  async execute(input: CreateRoleInput): Promise<Role> {
    const roleCd = new RoleCd(input.roleCd);
    const roleName = new RoleName(input.name);

    // 役割コード重複チェック
    const isCdDuplicated = await this.roleCdDuplicationCheckDomainService.execute(roleCd);
    if (isCdDuplicated) {
      throw new ValidationError(`既に存在する役割コードです: CD=${roleCd.value}`);
    }

    // 役割名重複チェック
    const isNameDuplicated = await this.roleNameDuplicationCheckDomainService.execute(input.name);
    if (isNameDuplicated) {
      throw new ValidationError(`既に存在する役割名です: ${input.name}`);
    }

    // 役職存在確認
    const positionId = new PositionId(input.positionId);
    const positionExists = await this.positionRepository.exists(positionId);
    if (!positionExists) {
      throw new ValidationError(`役職が存在しません: ID=${input.positionId}`);
    }

    // 上位役割バリデーション
    const superiorRoleId = input.superiorRoleId ? new RoleId(input.superiorRoleId) : null;
    if (superiorRoleId) {
      await this.superiorRoleValidationDomainService.execute(positionId, superiorRoleId);
    }

    const newRole = Role.create(roleCd, roleName, positionId, superiorRoleId);

    return await this.roleRepository.insert(newRole);
  }
}
