import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { Employee as PrismaEmployee } from "@generated/prisma/client";

/**
 * EmployeeMapper
 *
 * PrismaのEmployeeモデルとドメインのEmployeeエンティティを相互変換する
 * Note: roleはEmployee側では管理せず、User.roleで管理
 */
export class EmployeeMapper {
  /**
   * Prismaモデルからドメインエンティティへ変換
   *
   * @param prismaEmployee PrismaのEmployeeモデル
   * @returns ドメインのEmployeeエンティティ
   */
  static toDomain(prismaEmployee: PrismaEmployee): Employee {
    const employeeCd = new EmployeeCd(prismaEmployee.employeeCd);
    const email = new MailAddress(prismaEmployee.email);
    const name = new EmployeeName(prismaEmployee.name);

    return Employee.reconstruct(
      prismaEmployee.id,
      employeeCd,
      email,
      name,
      prismaEmployee.createdAt,
      prismaEmployee.updatedAt
    );
  }

  /**
   * ドメインエンティティからPrismaモデル用のデータへ変換
   *
   * @param employee ドメインのEmployeeエンティティ
   * @returns Prisma作成用データ
   */
  static toPrismaCreate(employee: Employee) {
    return {
      id: employee.id,
      employeeCd: employee.employeeCd.value,
      email: employee.email.value,
      name: employee.name.value,
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
      updatedAt: employee.updatedAt,
    };
  }
}
