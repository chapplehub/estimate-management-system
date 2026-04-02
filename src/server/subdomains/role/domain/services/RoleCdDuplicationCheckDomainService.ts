import { RoleRepository } from "../repositories/RoleRepository";
import { RoleCd } from "../values/RoleCd";

/**
 * 役割コード重複チェックドメインサービス
 */
export class RoleCdDuplicationCheckDomainService {
  constructor(private readonly roleRepository: RoleRepository) {}

  async execute(roleCd: RoleCd): Promise<boolean> {
    const existingRole = await this.roleRepository.findByRoleCd(roleCd);
    return !!existingRole;
  }
}
