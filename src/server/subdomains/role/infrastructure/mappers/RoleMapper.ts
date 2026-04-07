import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
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
      new RoleId(prismaRole.id),
      roleCd,
      name,
      new PositionId(prismaRole.positionId),
      prismaRole.superiorRoleId ? new RoleId(prismaRole.superiorRoleId) : null,
      prismaRole.createdAt,
      prismaRole.updatedAt
    );
  }

  /**
   * ドメインエンティティからPrismaモデル用のデータへ変換（新規作成用）
   */
  static toPrismaCreate(role: Role) {
    return {
      id: role.id.value,
      roleCd: role.roleCd.value,
      name: role.name.value,
      positionId: role.positionId.value,
      superiorRoleId: role.superiorRoleId?.value ?? null,
    };
  }

  /**
   * ドメインエンティティからPrismaモデル更新用のデータへ変換
   * positionId, roleCd は変更不可
   */
  static toPrismaUpdate(role: Role) {
    return {
      name: role.name.value,
      superiorRoleId: role.superiorRoleId?.value ?? null,
      updatedAt: role.updatedAt,
    };
  }
}
