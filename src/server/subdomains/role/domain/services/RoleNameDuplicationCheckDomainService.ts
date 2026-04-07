import { RoleRepository } from "../repositories/RoleRepository";
import { RoleId } from "../values/RoleId";

/**
 * 役割名重複チェックドメインサービス
 */
export class RoleNameDuplicationCheckDomainService {
  constructor(private readonly roleRepository: RoleRepository) {}

  /**
   * @param name 検査する役割名
   * @param excludeId 除外するID（更新時に自分自身を除外するため）
   * @returns 重複がある場合 true
   */
  async execute(name: string, excludeId?: RoleId): Promise<boolean> {
    const existingRole = await this.roleRepository.findByName(name);
    if (!existingRole) {
      return false;
    }
    // 更新時: 自分自身は除外
    if (excludeId && existingRole.id.equals(excludeId)) {
      return false;
    }
    return true;
  }
}
