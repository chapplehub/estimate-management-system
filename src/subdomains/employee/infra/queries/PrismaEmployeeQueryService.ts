import { EmployeeDTO } from "@/subdomains/employee/queries/dto/EmployeeDTO";
import {
  EmployeeSearchCriteria,
  ListOptions,
} from "@/subdomains/employee/queries/dto/EmployeeSearchCriteria";
import { IEmployeeQueryService } from "@/subdomains/employee/queries/IEmployeeQueryService";
import prisma from "@lib/prisma";
import { Prisma } from "@generated/prisma/client";

/**
 * Prismaを使用した従業員クエリサービス実装
 *
 * データベースから直接DTOを取得し、軽量で高速な読み取りを実現
 */
export class PrismaEmployeeQueryService implements IEmployeeQueryService {
  async findById(id: string): Promise<EmployeeDTO | null> {
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: this.getSelectFields(),
    });

    return employee ? this.toDTO(employee) : null;
  }

  async findByEmail(email: string): Promise<EmployeeDTO | null> {
    const employee = await prisma.employee.findUnique({
      where: { email },
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

  async search(
    criteria: EmployeeSearchCriteria,
    options?: ListOptions
  ): Promise<EmployeeDTO[]> {
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

  async findAll(options?: ListOptions): Promise<EmployeeDTO[]> {
    const orderBy = this.buildOrderBy(options);

    const employees = await prisma.employee.findMany({
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return employees.map((e) => this.toDTO(e));
  }

  async count(criteria: EmployeeSearchCriteria): Promise<number> {
    const where = this.buildWhereClause(criteria);
    return await prisma.employee.count({ where });
  }

  /**
   * 検索条件からPrismaのWHERE句を構築
   */
  private buildWhereClause(
    criteria: EmployeeSearchCriteria
  ): Prisma.EmployeeWhereInput {
    const where: Prisma.EmployeeWhereInput = {};

    if (criteria.name) {
      where.name = { contains: criteria.name };
    }

    if (criteria.email) {
      where.email = { contains: criteria.email };
    }

    if (criteria.employeeCd) {
      where.employeeCd = criteria.employeeCd;
    }

    if (criteria.role !== undefined) {
      where.role = criteria.role;
    }

    if (criteria.isLocked !== undefined) {
      // isLocked は lockedUntil の有無と現在時刻で判断
      if (criteria.isLocked) {
        // ロック中: lockedUntil が現在時刻より未来
        where.lockedUntil = { gt: new Date() };
      } else {
        // ロックされていない: lockedUntil が null または過去
        where.OR = [
          { lockedUntil: null },
          { lockedUntil: { lte: new Date() } },
        ];
      }
    }

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
  private buildOrderBy(
    options?: ListOptions
  ): Prisma.EmployeeOrderByWithRelationInput | undefined {
    if (!options?.orderBy) {
      return undefined;
    }

    return {
      [options.orderBy.field]: options.orderBy.direction,
    };
  }

  /**
   * DTOに必要なフィールドのみを取得するためのselect定義
   * Entityの完全な再構築を避け、必要なデータだけを取得
   */
  private getSelectFields() {
    return {
      id: true,
      employeeCd: true,
      email: true,
      name: true,
      role: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
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
    role: string;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): EmployeeDTO {
    return {
      id: employee.id,
      employeeCd: employee.employeeCd,
      email: employee.email,
      name: employee.name,
      role: employee.role as "ADMIN" | "USER",
      failedLoginAttempts: employee.failedLoginAttempts,
      lockedUntil: employee.lockedUntil,
      lastLoginAt: employee.lastLoginAt,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    };
  }
}
