import { Employee } from "@/domain/entities/Employee";
import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import prisma from "@/lib/prisma";
import { EmployeeMapper } from "@/Infrastructure/mappers/EmployeeMapper";

export class PrismaEmployeeRepository implements IEmployeeRepository {
  // ClientManagerをDIする
  // constructor(private prisma: PrismaClientManager) {}

  /**
   * 新規従業員を保存
   *
   * @param employee 従業員エンティティ
   */
  async save(employee: Employee): Promise<void> {
    const data = EmployeeMapper.toPrismaCreate(employee);
    await prisma.employee.create({ data });
  }

  /**
   * 既存従業員を更新
   *
   * @param employee 従業員エンティティ
   */
  async update(employee: Employee): Promise<void> {
    const data = EmployeeMapper.toPrismaUpdate(employee);
    await prisma.employee.update({
      where: { id: employee.id },
      data,
    });
  }

  /**
   * 従業員を削除
   *
   * @param employeeCd 社員コード
   */
  async delete(employeeCd: EmployeeCd): Promise<void> {
    await prisma.employee.delete({
      where: { employeeCd: employeeCd.value },
    });
  }

  /**
   * 社員コードで従業員を検索
   *
   * @param employeeCd 社員コード
   * @returns 従業員エンティティ（見つからない場合はnull）
   */
  async find(employeeCd: EmployeeCd): Promise<Employee | null> {
    const prismaEmployee = await prisma.employee.findUnique({
      where: { employeeCd: employeeCd.value },
    });

    return prismaEmployee ? EmployeeMapper.toDomain(prismaEmployee) : null;
  }

  /**
   * 全従業員を取得
   *
   * @returns 従業員エンティティの配列（空の場合は空配列）
   */
  async findAll(): Promise<Array<Employee>> {
    const prismaEmployees = await prisma.employee.findMany();
    return prismaEmployees.map((pe) => EmployeeMapper.toDomain(pe));
  }
}
