import {
  DepartmentDTO,
  DepartmentTreeDTO,
} from "@subdomains/department/application/queries/dto/DepartmentDTO";
import {
  DepartmentSearchCriteria,
  DepartmentListOptions,
} from "@subdomains/department/application/queries/dto/DepartmentSearchCriteria";
import { DepartmentQueryService } from "@subdomains/department/application/queries/DepartmentQueryService";
import prisma from "@server/prisma";
import { Prisma } from "@generated/prisma/client";

/**
 * Prismaを使用した部署クエリサービス実装
 *
 * データベースから直接DTOを取得し、軽量で高速な読み取りを実現
 */
export class PrismaDepartmentQueryService implements DepartmentQueryService {
  async findById(id: string): Promise<DepartmentDTO | null> {
    const department = await prisma.department.findUnique({
      where: { id },
      select: this.getSelectFields(),
    });

    return department ? this.toDTO(department) : null;
  }

  async findByDepartmentCd(departmentCd: string): Promise<DepartmentDTO | null> {
    const department = await prisma.department.findUnique({
      where: { departmentCd },
      select: this.getSelectFields(),
    });

    return department ? this.toDTO(department) : null;
  }

  async search(
    criteria: DepartmentSearchCriteria,
    options?: DepartmentListOptions
  ): Promise<DepartmentDTO[]> {
    const where = this.buildWhereClause(criteria);
    const orderBy = this.buildOrderBy(options);

    const departments = await prisma.department.findMany({
      where,
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return departments.map((d) => this.toDTO(d));
  }

  async findAll(options?: DepartmentListOptions): Promise<DepartmentDTO[]> {
    const orderBy = this.buildOrderBy(options);

    const departments = await prisma.department.findMany({
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return departments.map((d) => this.toDTO(d));
  }

  async findActive(options?: DepartmentListOptions): Promise<DepartmentDTO[]> {
    const orderBy = this.buildOrderBy(options);

    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return departments.map((d) => this.toDTO(d));
  }

  async findChildren(parentId: string, options?: DepartmentListOptions): Promise<DepartmentDTO[]> {
    const orderBy = this.buildOrderBy(options) ?? { departmentCd: "asc" as const };

    const departments = await prisma.department.findMany({
      where: { parentId },
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return departments.map((d) => this.toDTO(d));
  }

  async findRootDepartments(options?: DepartmentListOptions): Promise<DepartmentDTO[]> {
    const orderBy = this.buildOrderBy(options) ?? { departmentCd: "asc" as const };

    const departments = await prisma.department.findMany({
      where: { parentId: null },
      select: this.getSelectFields(),
      orderBy,
      take: options?.limit,
      skip: options?.offset,
    });

    return departments.map((d) => this.toDTO(d));
  }

  async getTree(rootId?: string | null): Promise<DepartmentTreeDTO[]> {
    // 全部署を取得（有効なもののみ）
    const allDepartments = await prisma.department.findMany({
      where: { isActive: true },
      select: this.getSelectFields(),
      orderBy: { departmentCd: "asc" },
    });

    const departmentDTOs = allDepartments.map((d) => this.toDTO(d));

    // 階層構造を構築
    return this.buildTree(departmentDTOs, rootId ?? null);
  }

  /**
   * 検索条件からPrismaのWHERE句を構築
   */
  private buildWhereClause(criteria: DepartmentSearchCriteria): Prisma.DepartmentWhereInput {
    const where: Prisma.DepartmentWhereInput = {};

    if (criteria.name) {
      where.name = { contains: criteria.name, mode: "insensitive" };
    }

    if (criteria.abbreviation) {
      where.abbreviation = {
        contains: criteria.abbreviation,
        mode: "insensitive",
      };
    }

    if (criteria.departmentCd) {
      where.departmentCd = criteria.departmentCd;
    }

    if (criteria.isActive !== undefined) {
      where.isActive = criteria.isActive;
    }

    // parentIdは明示的にnullを許容する
    if (criteria.parentId !== undefined) {
      where.parentId = criteria.parentId;
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
    options?: DepartmentListOptions
  ): Prisma.DepartmentOrderByWithRelationInput | undefined {
    if (!options?.orderBy) {
      return undefined;
    }

    return {
      [options.orderBy.field]: options.orderBy.direction,
    };
  }

  /**
   * DTOに必要なフィールドのみを取得するためのselect定義
   */
  private getSelectFields() {
    return {
      id: true,
      departmentCd: true,
      name: true,
      abbreviation: true,
      isActive: true,
      parentId: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  /**
   * PrismaモデルからDTOへ変換
   */
  private toDTO(department: {
    id: string;
    departmentCd: string;
    name: string;
    abbreviation: string;
    isActive: boolean;
    parentId: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): DepartmentDTO {
    return {
      id: department.id,
      departmentCd: department.departmentCd,
      name: department.name,
      abbreviation: department.abbreviation,
      isActive: department.isActive,
      parentId: department.parentId,
      version: department.version,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }

  /**
   * フラットなDTOリストから階層構造を構築
   */
  private buildTree(departments: DepartmentDTO[], parentId: string | null): DepartmentTreeDTO[] {
    return departments
      .filter((d) => d.parentId === parentId)
      .map((d) => ({
        ...d,
        children: this.buildTree(departments, d.id),
      }));
  }
}
