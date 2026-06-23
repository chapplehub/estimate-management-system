import { RoleDTO } from "@subdomains/role/application/queries/dto/RoleDTO";
import {
  RoleSearchCriteria,
  RoleListOptions,
} from "@subdomains/role/application/queries/dto/RoleSearchCriteria";
import { RoleQueryService } from "@subdomains/role/application/queries/RoleQueryService";
import prisma from "@server/prisma";
import { Prisma } from "@generated/prisma/client";

/**
 * Prismaを使用した役割クエリサービス実装
 *
 * position, superiorRole をJOINして名前付きDTOを返す
 */
export class PrismaRoleQueryService implements RoleQueryService {
  async findById(id: string): Promise<RoleDTO | null> {
    const role = await prisma.role.findUnique({
      where: { id },
      select: this.getSelectFields(),
    });

    return role ? this.toDTO(role) : null;
  }

  async search(criteria: RoleSearchCriteria, options?: RoleListOptions): Promise<RoleDTO[]> {
    const where = this.buildWhereClause(criteria);
    const orderBy = this.buildOrderBy(options);

    const roles = await prisma.role.findMany({
      where,
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return roles.map((r) => this.toDTO(r));
  }

  async findAll(options?: RoleListOptions): Promise<RoleDTO[]> {
    const orderBy = this.buildOrderBy(options);

    const roles = await prisma.role.findMany({
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return roles.map((r) => this.toDTO(r));
  }

  async findByRoleCd(roleCd: string): Promise<RoleDTO | null> {
    const role = await prisma.role.findUnique({
      where: { roleCd },
      select: this.getSelectFields(),
    });

    return role ? this.toDTO(role) : null;
  }

  async findRoleIdsWithMembers(roleIds: string[]): Promise<Set<string>> {
    if (roleIds.length === 0) {
      return new Set();
    }

    // メンバー（EmployeeRole）が1件でも存在する役割IDだけを distinct で拾う。
    const rows = await prisma.employeeRole.findMany({
      where: { roleId: { in: roleIds } },
      distinct: ["roleId"],
      select: { roleId: true },
    });

    return new Set(rows.map((row) => row.roleId));
  }

  async findByPositionId(positionId: string, options?: RoleListOptions): Promise<RoleDTO[]> {
    const orderBy = this.buildOrderBy(options) ?? { roleCd: "asc" as const };

    const roles = await prisma.role.findMany({
      where: { positionId },
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return roles.map((r) => this.toDTO(r));
  }

  private buildWhereClause(criteria: RoleSearchCriteria): Prisma.RoleWhereInput {
    const where: Prisma.RoleWhereInput = {};

    if (criteria.name) {
      where.name = { contains: criteria.name, mode: "insensitive" };
    }

    if (criteria.roleCd) {
      where.roleCd = criteria.roleCd;
    }

    if (criteria.positionId) {
      where.positionId = criteria.positionId;
    }

    if (criteria.superiorRoleId !== undefined) {
      where.superiorRoleId = criteria.superiorRoleId;
    }

    return where;
  }

  private buildOrderBy(options?: RoleListOptions): Prisma.RoleOrderByWithRelationInput | undefined {
    if (!options?.orderBy) {
      return undefined;
    }

    return {
      [options.orderBy.field]: options.orderBy.direction,
    };
  }

  private getSelectFields() {
    return {
      id: true,
      roleCd: true,
      name: true,
      positionId: true,
      position: { select: { name: true } },
      superiorRoleId: true,
      superiorRole: { select: { name: true } },
      version: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private toDTO(role: {
    id: string;
    roleCd: string;
    name: string;
    positionId: string;
    position: { name: string };
    superiorRoleId: string | null;
    superiorRole: { name: string } | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): RoleDTO {
    return {
      id: role.id,
      roleCd: role.roleCd,
      name: role.name,
      positionId: role.positionId,
      positionName: role.position.name,
      superiorRoleId: role.superiorRoleId,
      superiorRoleName: role.superiorRole?.name ?? null,
      version: role.version,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
