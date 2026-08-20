import { Department } from "@subdomains/department/domain/entities/Department";
import { DepartmentCd } from "@subdomains/department/domain/values/DepartmentCd";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { DepartmentName } from "@subdomains/department/domain/values/DepartmentName";
import { Abbreviation } from "@subdomains/department/domain/values/Abbreviation";
import { Department as PrismaDepartment } from "@generated/prisma/client";

/**
 * DepartmentMapper
 *
 * PrismaのDepartmentモデルとドメインのDepartmentエンティティを相互変換する
 */
export class DepartmentMapper {
  /**
   * Prismaモデルからドメインエンティティへ変換
   *
   * @param prismaDepartment PrismaのDepartmentモデル
   * @returns ドメインのDepartmentエンティティ
   */
  static toDomain(prismaDepartment: PrismaDepartment): Department {
    const departmentCd = new DepartmentCd(prismaDepartment.departmentCd);
    const name = new DepartmentName(prismaDepartment.name);
    const abbreviation = new Abbreviation(prismaDepartment.abbreviation);

    return Department.reconstruct(
      new DepartmentId(prismaDepartment.id),
      departmentCd,
      name,
      abbreviation,
      prismaDepartment.isActive,
      prismaDepartment.parentId ? new DepartmentId(prismaDepartment.parentId) : null,
      prismaDepartment.createdAt,
      prismaDepartment.updatedAt
    );
  }

  /**
   * ドメインエンティティからPrismaモデル用のデータへ変換（新規作成用）
   *
   * @param department ドメインのDepartmentエンティティ
   * @returns Prisma作成用データ
   */
  static toPrismaCreate(department: Department) {
    return {
      id: department.id.value,
      departmentCd: department.departmentCd.value,
      name: department.name.value,
      abbreviation: department.abbreviation.value,
      isActive: department.isActive,
      parentId: department.parentId?.value ?? null,
    };
  }

  /**
   * ドメインエンティティからPrismaモデル更新用のデータへ変換
   *
   * @param department ドメインのDepartmentエンティティ
   * @returns Prisma更新用データ
   */
  static toPrismaUpdate(department: Department) {
    return {
      name: department.name.value,
      abbreviation: department.abbreviation.value,
      isActive: department.isActive,
      parentId: department.parentId?.value ?? null,
      updatedAt: department.updatedAt,
    };
  }
}
