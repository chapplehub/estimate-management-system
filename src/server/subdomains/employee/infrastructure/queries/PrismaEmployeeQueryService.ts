import { EmployeeDTO } from "@subdomains/employee/application/queries/dto/EmployeeDTO";
import {
  EmployeeSearchCriteria,
  ListOptions,
} from "@subdomains/employee/application/queries/dto/EmployeeSearchCriteria";
import { EmployeeQueryService } from "@subdomains/employee/application/queries/EmployeeQueryService";
import prisma from "@server/prisma";
import { Prisma } from "@generated/prisma/client";
import type { UserRole } from "@server/shared/auth/types";

/**
 * Prismaを使用した従業員クエリサービス実装
 *
 * データベースから直接DTOを取得し、軽量で高速な読み取りを実現
 * Note: roleはUser.roleから取得する
 */
export class PrismaEmployeeQueryService implements EmployeeQueryService {
  async findById(id: string): Promise<EmployeeDTO | null> {
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: this.getSelectFields(),
    });

    return employee ? this.toDTO(employee) : null;
  }

  async findByEmployeeCd(employeeCd: string): Promise<EmployeeDTO | null> {
    const employee = await prisma.employee.findFirst({
      where: { employeeCd },
      select: this.getSelectFields(),
    });

    return employee ? this.toDTO(employee) : null;
  }

  async search(criteria: EmployeeSearchCriteria, options?: ListOptions): Promise<EmployeeDTO[]> {
    const where = this.buildWhereClause(criteria);
    const orderBy = this.buildOrderBy(options);

    const employees = await prisma.employee.findMany({
      where,
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return employees.map((e) => this.toDTO(e));
  }

  async findSuperiorRoleId(employeeId: string): Promise<string | null> {
    // 上位役割は列に持たず読み取り時導出する（ADR-20260707-k4e。承認起点の唯一の消費点）。
    //   担当役割あり → その担当役割の上位役割（役割階層の1段上）
    //   担当役割なし（課員）→ EmployeeSuperiorRole の明示値
    //   どちらも無     → null
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        // 担当役割（高々1件）とその役割の上位役割ID
        employeeRoles: {
          select: { role: { select: { superiorRoleId: true } } },
        },
        // 課員の明示上位役割（0/1 件）
        superiorRole: {
          select: { roleId: true },
        },
      },
    });

    if (!employee) {
      return null;
    }

    // 担当役割を持つなら、その役割の上位役割を承認起点とする（役割持ちは明示行を持たない・I1）
    const assignedRole = employee.employeeRoles[0]?.role;
    if (assignedRole) {
      return assignedRole.superiorRoleId ?? null;
    }

    // 課員は明示行の値を承認起点とする
    return employee.superiorRole?.roleId ?? null;
  }

  /**
   * 検索条件からPrismaのWHERE句を構築
   */
  private buildWhereClause(criteria: EmployeeSearchCriteria): Prisma.EmployeeWhereInput {
    const where: Prisma.EmployeeWhereInput = {};

    if (criteria.name) {
      where.name = { contains: criteria.name, mode: "insensitive" };
    }

    if (criteria.email) {
      where.email = { contains: criteria.email, mode: "insensitive" };
    }

    if (criteria.employeeCd) {
      where.employeeCd = criteria.employeeCd;
    }

    if (criteria.departmentId) {
      where.departmentId = criteria.departmentId;
    }

    // roleでのフィルタはUser.roleを使用
    if (criteria.role !== undefined) {
      where.user = { role: criteria.role };
    }

    // NOTE: isLocked 検索は認証を better-auth に移行したため削除
    // 将来的に User テーブルの ban 状態で検索する場合は別途実装

    if (criteria.createdAfter || criteria.createdBefore) {
      where.createdAt = {};
      if (criteria.createdAfter) {
        where.createdAt.gte = criteria.createdAfter;
      }
      if (criteria.createdBefore) {
        where.createdAt.lte = criteria.createdBefore;
      }
    }

    return where;
  }

  /**
   * ListOptionsからPrismaのOrderBy句を構築
   */
  private buildOrderBy(options?: ListOptions): Prisma.EmployeeOrderByWithRelationInput | undefined {
    if (!options?.orderBy) {
      return undefined;
    }

    return {
      [options.orderBy.field]: options.orderBy.direction,
    };
  }

  /**
   * DTOに必要なフィールドのみを取得するためのselect定義
   * User.roleも含めて取得する
   */
  private getSelectFields() {
    return {
      id: true,
      employeeCd: true,
      email: true,
      name: true,
      departmentId: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      // Department.nameを取得
      department: {
        select: {
          name: true,
        },
      },
      // User.roleを取得
      user: {
        select: {
          role: true,
        },
      },
      // 担当役割（高々1件・ADR-20260706-c89）を取得
      employeeRoles: {
        select: {
          roleId: true,
        },
      },
    } as const;
  }

  /**
   * PrismaモデルからDTOへ変換
   */
  private toDTO(employee: {
    id: string;
    employeeCd: string;
    email: string;
    name: string;
    departmentId: string;
    department: { name: string };
    version: number;
    createdAt: Date;
    updatedAt: Date;
    user: { role: string | null } | null;
    employeeRoles: { roleId: string }[];
  }): EmployeeDTO {
    return {
      id: employee.id,
      employeeCd: employee.employeeCd,
      email: employee.email,
      name: employee.name,
      departmentId: employee.departmentId,
      departmentName: employee.department.name,
      // User.roleを使用（"admin" | "user" | null）
      role: (employee.user?.role as UserRole) ?? null,
      // 高々1件の担当役割を導出（0件＝役割なし＝課員）
      assignedRoleId: employee.employeeRoles[0]?.roleId ?? null,
      version: employee.version,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
