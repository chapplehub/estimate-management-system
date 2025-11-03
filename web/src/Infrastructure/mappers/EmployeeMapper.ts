import { Employee } from "@/domain/entities/Employee";
import { Role } from "@/domain/types/Role";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";
import { Employee as PrismaEmployee } from "@generated/prisma/client";

/**
 * EmployeeMapper
 *
 * PrismaのEmployeeモデルとドメインのEmployeeエンティティを相互変換する
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

    return Employee.reconstruct(
      prismaEmployee.id,
      employeeCd,
      email,
      prismaEmployee.name,
      prismaEmployee.passwordHash,
      prismaEmployee.role as Role,
      prismaEmployee.failedLoginAttempts,
      prismaEmployee.lockedUntil,
      prismaEmployee.lastLoginAt,
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
      employeeCd: employee.employeeCd.value,
      email: employee.email.value,
      name: employee.name,
      passwordHash: employee.passwordHash,
      role: employee.role,
      failedLoginAttempts: employee.failedLoginAttempts,
      lockedUntil: employee.lockedUntil,
      lastLoginAt: employee.lastLoginAt,
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
      name: employee.name,
      passwordHash: employee.passwordHash,
      role: employee.role,
      failedLoginAttempts: employee.failedLoginAttempts,
      lockedUntil: employee.lockedUntil,
      lastLoginAt: employee.lastLoginAt,
      updatedAt: employee.updatedAt,
    };
  }
}
