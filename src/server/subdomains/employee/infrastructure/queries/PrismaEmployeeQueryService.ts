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
      createdAt: true,
      updatedAt: true,
      // User.roleを取得
      user: {
        select: {
          role: true,
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
    createdAt: Date;
    updatedAt: Date;
    user: { role: string | null } | null;
  }): EmployeeDTO {
    return {
      id: employee.id,
      employeeCd: employee.employeeCd,
      email: employee.email,
      name: employee.name,
      departmentId: employee.departmentId,
      // User.roleを使用（"admin" | "user" | null）
      role: (employee.user?.role as UserRole) ?? null,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
