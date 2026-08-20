import { Department } from "@subdomains/department/domain/entities/Department";
import { DepartmentRepository } from "@subdomains/department/domain/repositories/DepartmentRepository";
import { DepartmentCd } from "@subdomains/department/domain/values/DepartmentCd";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { DepartmentMapper } from "@subdomains/department/infrastructure/mappers/DepartmentMapper";
import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";

export class PrismaDepartmentRepository implements DepartmentRepository {
  /**
   * 部署を新規作成
   *
   * @param department 部署エンティティ
   * @returns 保存後の部署エンティティ（version は @default(1)）
   */
  async insert(department: Department): Promise<Department> {
    const prismaDepartment = await prisma.department.create({
      data: DepartmentMapper.toPrismaCreate(department),
    });

    return DepartmentMapper.toDomain(prismaDepartment);
  }

  /**
   * 既存部署を更新（楽観ロック / ADR-0039）
   *
   * WHERE id AND version の条件付き UPDATE で「比較→更新」を DB 上で原子化し、
   * 成功時に version を +1 する。count = 0 は「version 不一致（先行更新あり）」と
   * 「行の消失（削除済み）」の両方を含むが、UPDATE 文からは区別できないため
   * 両方を覆うメッセージで競合として扱う（ADR-0039 細目5/6）。
   *
   * @param department 更新後の部署エンティティ
   * @param expectedVersion 編集画面表示時のトークン（フォーム往復で持ち回った値）
   * @returns 更新後（version 反映済み）の部署エンティティ
   */
  async update(department: Department, expectedVersion: number): Promise<Department> {
    const result = await prisma.department.updateMany({
      where: { id: department.id.value, version: expectedVersion },
      data: {
        ...DepartmentMapper.toPrismaUpdate(department),
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
      );
    }

    // version を進めた最新行を読み直して返す
    const row = await prisma.department.findUnique({ where: { id: department.id.value } });
    if (!row) {
      throw new Error(`保存した部署の再取得に失敗しました: ${department.id.value}`);
    }

    return DepartmentMapper.toDomain(row);
  }

  /**
   * 部署を削除（楽観ロック / ADR-0039 細目3）
   *
   * WHERE id AND version の条件付き deleteMany で「比較→削除」を DB 上で原子化する。
   * count = 0 は「version 不一致（先行更新あり）」と「行の消失（削除済み）」の両方を含むが
   * 区別できないため、両方を覆うメッセージで競合として扱う（ADR-0039 細目5/6）。
   *
   * @param id 部署ID
   * @param expectedVersion 削除画面表示時のトークン（フォーム往復で持ち回った値）
   */
  async delete(id: DepartmentId, expectedVersion: number): Promise<void> {
    const result = await prisma.department.deleteMany({
      where: { id: id.value, version: expectedVersion },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
      );
    }
  }

  /**
   * IDで部署を検索
   *
   * @param id 部署ID
   * @returns 部署エンティティ（見つからない場合はnull）
   */
  async findById(id: DepartmentId): Promise<Department | null> {
    const prismaDepartment = await prisma.department.findUnique({
      where: { id: id.value },
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
  async findChildren(parentId: DepartmentId): Promise<Department[]> {
    const prismaDepartments = await prisma.department.findMany({
      where: { parentId: parentId.value },
      orderBy: { departmentCd: "asc" },
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
      orderBy: { departmentCd: "asc" },
    });

    return prismaDepartments.map(DepartmentMapper.toDomain);
  }
}
