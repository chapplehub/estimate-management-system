import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { Role as PrismaRole } from "@generated/prisma/client";

/**
 * RoleMapper
 *
 * PrismaのRoleモデルとドメインのRoleエンティティを相互変換する
 */
export class RoleMapper {
  /**
   * Prismaモデルからドメインエンティティへ変換
   */
  static toDomain(prismaRole: PrismaRole): Role {
    const roleCd = new RoleCd(prismaRole.roleCd);
    const name = new RoleName(prismaRole.name);

    return Role.reconstruct(
      prismaRole.id,
      roleCd,
      name,
      prismaRole.positionId,
      prismaRole.superiorRoleId,
      prismaRole.createdAt,
      prismaRole.updatedAt
    );
  }

  /**
   * ドメインエンティティからPrismaモデル用のデータへ変換（新規作成用）
   */
  static toPrismaCreate(role: Role) {
    return {
      id: role.id,
      roleCd: role.roleCd.value,
      name: role.name.value,
      positionId: role.positionId,
      superiorRoleId: role.superiorRoleId,
    };
  }

  /**
   * ドメインエンティティからPrismaモデル更新用のデータへ変換
   * positionId, roleCd は変更不可
   */
  static toPrismaUpdate(role: Role) {
    return {
      name: role.name.value,
      superiorRoleId: role.superiorRoleId,
      updatedAt: role.updatedAt,
    };
  }
}
