import { Department } from "@subdomains/department/domain/entities/Department";
import { IDepartmentRepository } from "@subdomains/department/domain/repositories/IDepartmentRepository";
import { DepartmentCd } from "@subdomains/department/domain/values/DepartmentCd";
import { DepartmentMapper } from "@subdomains/department/infrastructure/mappers/DepartmentMapper";
import prisma from "@server/prisma";

export class PrismaDepartmentRepository implements IDepartmentRepository {
  /**
   * 部署を保存（新規作成・更新の両方に対応）
   *
   * @param department 部署エンティティ
   * @returns 保存後の部署エンティティ
   */
  async save(department: Department): Promise<Department> {
    let prismaDepartment;

    if (department.id) {
      // IDが存在する場合：upsert（更新 or 作成）
      prismaDepartment = await prisma.department.upsert({
        where: { id: department.id },
        create: DepartmentMapper.toPrismaCreate(department),
        update: DepartmentMapper.toPrismaUpdate(department),
      });
    } else {
      // IDが空の場合：新規作成
      const data = DepartmentMapper.toPrismaCreate(department);
      prismaDepartment = await prisma.department.create({ data });
    }

    return DepartmentMapper.toDomain(prismaDepartment);
  }

  /**
   * 部署を削除
   *
   * @param id 部署ID
   */
  async delete(id: string): Promise<void> {
    await prisma.department.delete({
      where: { id: id },
    });
  }

  /**
   * IDで部署を検索
   *
   * @param id 部署ID
   * @returns 部署エンティティ（見つからない場合はnull）
   */
  async findById(id: string): Promise<Department | null> {
    const prismaDepartment = await prisma.department.findUnique({
      where: { id: id },
    });

    return prismaDepartment ? DepartmentMapper.toDomain(prismaDepartment) : null;
  }

  /**
   * 部署コードで部署を検索
   *
   * @param departmentCd 部署コード
   * @returns 部署エンティティ（見つからない場合はnull）
   */
  async findByDepartmentCd(departmentCd: DepartmentCd): Promise<Department | null> {
    const prismaDepartment = await prisma.department.findUnique({
      where: { departmentCd: departmentCd.value },
    });

    return prismaDepartment ? DepartmentMapper.toDomain(prismaDepartment) : null;
  }

  /**
   * 子部署を取得
   *
   * @param parentId 親部署ID
   * @returns 子部署の配列
   */
  async findChildren(parentId: string): Promise<Department[]> {
    const prismaDepartments = await prisma.department.findMany({
      where: { parentId: parentId },
      orderBy: { displayOrder: "asc" },
    });

    return prismaDepartments.map(DepartmentMapper.toDomain);
  }

  /**
   * ルート部署（parentIdがnull）を全て取得
   *
   * @returns ルート部署の配列
   */
  async findRootDepartments(): Promise<Department[]> {
    const prismaDepartments = await prisma.department.findMany({
      where: { parentId: null },
      orderBy: { displayOrder: "asc" },
    });

    return prismaDepartments.map(DepartmentMapper.toDomain);
  }
}
