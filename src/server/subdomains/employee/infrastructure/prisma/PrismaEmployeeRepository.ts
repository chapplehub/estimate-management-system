import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeRepository } from "@subdomains/employee/domain/repositories/EmployeeRepository";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { EmployeeMapper } from "@subdomains/employee/infrastructure/mappers/EmployeeMapper";
import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";

export class PrismaEmployeeRepository implements EmployeeRepository {
  // ClientManagerをDIする
  // constructor(private prisma: PrismaClientManager) {}

  /**
   * 従業員を新規作成（version は @default(1)）
   *
   * 担当役割ありの場合は EmployeeRole 子行をネスト作成で同時に作る（原子性）。
   */
  async insert(employee: Employee): Promise<Employee> {
    const prismaEmployee = await prisma.employee.create({
      data: EmployeeMapper.toPrismaCreate(employee),
      include: { employeeRoles: true, superiorRole: true },
    });

    return EmployeeMapper.toDomain(prismaEmployee);
  }

  /**
   * 既存従業員を更新（楽観ロック / ADR-0039）
   *
   * WHERE id AND version の条件付き UPDATE で「比較→更新」を DB 上で原子化し、
   * 成功時に version を +1 する。count = 0 は「version 不一致（先行更新あり）」と
   * 「行の消失（削除済み）」の両方を含むが、UPDATE 文からは区別できないため
   * 両方を覆うメッセージで競合として扱う（ADR-0039 細目5/6）。
   *
   * @param expectedVersion 編集画面表示時のトークン（フォーム往復で持ち回った値）
   */
  async update(employee: Employee, expectedVersion: number): Promise<Employee> {
    // 担当役割（EmployeeRole 子行）の同期を versioned update と同一トランザクションで行い、
    // Employee.version（ADR-0039）で直列化する。子行の置換は「旧行全削除 → 必要なら新行作成」。
    return prisma.$transaction(async (tx) => {
      const result = await tx.employee.updateMany({
        where: { id: employee.id.value, version: expectedVersion },
        data: {
          ...EmployeeMapper.toPrismaUpdate(employee),
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ConflictError(
          "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
        );
      }

      // 担当役割を 0/1 件へ同期する（高々1件・ADR-20260706-c89）
      await tx.employeeRole.deleteMany({ where: { employeeId: employee.id.value } });
      if (employee.assignedRoleId) {
        await tx.employeeRole.create({
          data: { employeeId: employee.id.value, roleId: employee.assignedRoleId.value },
        });
      }

      // 課員の明示上位役割を 0/1 件へ同期する（ADR-20260707-k4e。I1 により役割持ちは常に 0 件）
      await tx.employeeSuperiorRole.deleteMany({ where: { employeeId: employee.id.value } });
      if (employee.explicitSuperiorRoleId) {
        await tx.employeeSuperiorRole.create({
          data: { employeeId: employee.id.value, roleId: employee.explicitSuperiorRoleId.value },
        });
      }

      // version を進めた最新行を読み直して返す
      const row = await tx.employee.findUnique({
        where: { id: employee.id.value },
        include: { employeeRoles: true, superiorRole: true },
      });
      if (!row) {
        throw new Error(`保存した従業員の再取得に失敗しました: ${employee.id.value}`);
      }

      return EmployeeMapper.toDomain(row);
    });
  }

  /**
   * 従業員を削除
   *
   * @param id
   */
  async delete(id: EmployeeId): Promise<void> {
    await prisma.employee.delete({
      where: { id: id.value },
    });
  }

  /**
   * idで従業員を検索
   *
   * @param id
   * @returns 従業員エンティティ（見つからない場合はnull）
   */
  async findById(id: EmployeeId): Promise<Employee | null> {
    const prismaEmployee = await prisma.employee.findUnique({
      where: { id: id.value },
      include: { employeeRoles: true, superiorRole: true },
    });

    return prismaEmployee ? EmployeeMapper.toDomain(prismaEmployee) : null;
  }

  /**
   * 社員コードで従業員を検索
   *
   * @param employeeCd
   * @returns 従業員エンティティ（見つからない場合はnull）
   */
  async findByEmployeeCd(employeeCd: EmployeeCd): Promise<Employee | null> {
    const prismaEmployee = await prisma.employee.findUnique({
      where: { employeeCd: employeeCd.value },
      include: { employeeRoles: true, superiorRole: true },
    });

    return prismaEmployee ? EmployeeMapper.toDomain(prismaEmployee) : null;
  }

  /**
   * メールアドレスで従業員を検索
   *
   * @param email
   * @returns 従業員エンティティ（見つからない場合はnull）
   */
  async findByEmail(email: MailAddress): Promise<Employee | null> {
    const prismaEmployee = await prisma.employee.findUnique({
      where: { email: email.value },
      include: { employeeRoles: true, superiorRole: true },
    });

    return prismaEmployee ? EmployeeMapper.toDomain(prismaEmployee) : null;
  }
}
