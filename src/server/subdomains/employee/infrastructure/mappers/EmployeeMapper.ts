import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { Prisma } from "@generated/prisma/client";

/**
 * 担当役割（EmployeeRole 子行）を含む Prisma Employee ペイロード。
 * toDomain は担当役割を復元するため子行の同梱を前提とする。
 */
export type PrismaEmployeeWithRoles = Prisma.EmployeeGetPayload<{
  include: { employeeRoles: true };
}>;

/**
 * EmployeeMapper
 *
 * PrismaのEmployeeモデルとドメインのEmployeeエンティティを相互変換する
 * Note: 認証ロールはEmployee側では管理せず、User.roleで管理。
 *       担当役割は多対多結合表 EmployeeRole を維持しつつ、集約では高々1件として
 *       扱う（ADR-20260706-c89）。書き込みは 0/1 件へ同期する。
 */
export class EmployeeMapper {
  /**
   * Prismaモデルからドメインエンティティへ変換
   *
   * @param prismaEmployee 担当役割子行を同梱した PrismaのEmployeeモデル
   * @returns ドメインのEmployeeエンティティ
   */
  static toDomain(prismaEmployee: PrismaEmployeeWithRoles): Employee {
    const employeeCd = new EmployeeCd(prismaEmployee.employeeCd);
    const email = new MailAddress(prismaEmployee.email);
    const name = new EmployeeName(prismaEmployee.name);

    // 高々1件の担当役割を子行から導出（0件＝役割なし＝課員）
    const assignedRoleId =
      prismaEmployee.employeeRoles.length > 0
        ? new RoleId(prismaEmployee.employeeRoles[0].roleId)
        : null;

    // 課員の明示上位役割は Step 5 で employee_superior_roles 行から復元する。
    // 本ステップ（集約シグネチャ変更）では整合のため一律 null を渡す。
    const explicitSuperiorRoleId = null;

    return Employee.reconstruct(
      new EmployeeId(prismaEmployee.id),
      employeeCd,
      email,
      name,
      new DepartmentId(prismaEmployee.departmentId),
      assignedRoleId,
      explicitSuperiorRoleId,
      prismaEmployee.createdAt,
      prismaEmployee.updatedAt
    );
  }

  /**
   * ドメインエンティティからPrismaモデル用のデータへ変換
   *
   * 担当役割ありの場合は EmployeeRole 子行をネスト作成する。
   *
   * @param employee ドメインのEmployeeエンティティ
   * @returns Prisma作成用データ
   */
  static toPrismaCreate(employee: Employee) {
    return {
      id: employee.id.value,
      employeeCd: employee.employeeCd.value,
      email: employee.email.value,
      name: employee.name.value,
      departmentId: employee.departmentId.value,
      employeeRoles: employee.assignedRoleId
        ? { create: [{ roleId: employee.assignedRoleId.value }] }
        : undefined,
    };
  }

  /**
   * ドメインエンティティからPrismaモデル更新用のデータへ変換
   *
   * @param employee ドメインのEmployeeエンティティ
   * @returns Prisma更新用データ
   */
  static toPrismaUpdate(employee: Employee) {
    return {
      email: employee.email.value,
      name: employee.name.value,
      departmentId: employee.departmentId.value,
      updatedAt: employee.updatedAt,
    };
  }
}
