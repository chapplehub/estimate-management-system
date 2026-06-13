import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleRepository } from "@subdomains/role/domain/repositories/RoleRepository";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { RoleMapper } from "@subdomains/role/infrastructure/mappers/RoleMapper";
import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";

export class PrismaRoleRepository implements RoleRepository {
  async insert(role: Role): Promise<Role> {
    const prismaRole = await prisma.role.create({
      data: RoleMapper.toPrismaCreate(role),
    });

    return RoleMapper.toDomain(prismaRole);
  }

  /**
   * 既存役割を更新（楽観ロック / ADR-0039）。
   *
   * Role は子を持たない単一テーブル集約のため、WHERE id AND version の条件付き
   * updateMany 1 文で「比較→更新」を DB 上で原子化できる（estimate のような
   * トランザクション＋差分 upsert は不要）。成功時に version を +1 する。
   * count 0 は「version 不一致（先行更新あり）」と「行の消失（削除済み）」の両方を
   * 含むが UPDATE 文からは区別できないため、両方を覆うメッセージで競合として扱う。
   */
  async update(role: Role, expectedVersion: number): Promise<Role> {
    const result = await prisma.role.updateMany({
      where: { id: role.id.value, version: expectedVersion },
      data: {
        ...RoleMapper.toPrismaUpdate(role),
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
      );
    }

    // updateMany は更新後の行を返さないため、+1 された version を含めて読み直す。
    const updated = await prisma.role.findUnique({ where: { id: role.id.value } });
    if (!updated) {
      throw new Error(`保存した役割の再取得に失敗しました: ${role.id.value}`);
    }

    return RoleMapper.toDomain(updated);
  }

  /**
   * 役割を削除（楽観ロック / ADR-0039 細目3）
   *
   * WHERE id AND version の条件付き deleteMany で「比較→削除」を DB 上で原子化する。
   * count = 0 は「version 不一致（先行更新あり）」と「行の消失（削除済み）」の両方を含むが
   * 区別できないため、両方を覆うメッセージで競合として扱う（ADR-0039 細目5/6）。
   *
   * @param expectedVersion 削除画面表示時のトークン（フォーム往復で持ち回った値）
   */
  async delete(id: RoleId, expectedVersion: number): Promise<void> {
    const result = await prisma.role.deleteMany({
      where: { id: id.value, version: expectedVersion },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
      );
    }
  }

  async findById(id: RoleId): Promise<Role | null> {
    const prismaRole = await prisma.role.findUnique({
      where: { id: id.value },
    });

    return prismaRole ? RoleMapper.toDomain(prismaRole) : null;
  }

  async findByRoleCd(roleCd: RoleCd): Promise<Role | null> {
    const prismaRole = await prisma.role.findUnique({
      where: { roleCd: roleCd.value },
    });

    return prismaRole ? RoleMapper.toDomain(prismaRole) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const prismaRole = await prisma.role.findFirst({
      where: { name },
    });

    return prismaRole ? RoleMapper.toDomain(prismaRole) : null;
  }

  async findSubordinates(superiorRoleId: RoleId): Promise<Role[]> {
    const prismaRoles = await prisma.role.findMany({
      where: { superiorRoleId: superiorRoleId.value },
      orderBy: { roleCd: "asc" },
    });

    return prismaRoles.map(RoleMapper.toDomain);
  }

  async isInUse(roleId: RoleId): Promise<boolean> {
    const [employeeRoleCount, employeeSuperiorCount] = await Promise.all([
      prisma.employeeRole.count({ where: { roleId: roleId.value } }),
      prisma.employee.count({ where: { superiorRoleId: roleId.value } }),
    ]);

    return employeeRoleCount > 0 || employeeSuperiorCount > 0;
  }
}
