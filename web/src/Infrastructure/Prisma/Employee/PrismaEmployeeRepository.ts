import { Employee } from "@/domain/entities/Employee";
import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { EmployeeMapper } from "@/Infrastructure/mappers/EmployeeMapper";
import prisma from "@lib/prisma";

export class PrismaEmployeeRepository implements IEmployeeRepository {
  // ClientManagerをDIする
  // constructor(private prisma: PrismaClientManager) {}

  /**
   * 従業員を保存（新規作成・更新の両方に対応）
   *
   * @param employee 従業員エンティティ
   * @returns 保存後の従業員エンティティ
   */
  async save(employee: Employee): Promise<Employee> {
    let prismaEmployee;

    if (employee.id) {
      // IDが存在する場合：upsert（更新 or 作成）
      prismaEmployee = await prisma.employee.upsert({
        where: { id: employee.id },
        create: EmployeeMapper.toPrismaCreate(employee),
        update: EmployeeMapper.toPrismaUpdate(employee),
      });
    } else {
      // IDが空の場合：新規作成
      const data = EmployeeMapper.toPrismaCreate(employee);
      prismaEmployee = await prisma.employee.create({ data });
    }

    return EmployeeMapper.toDomain(prismaEmployee);
  }

  /**
   * 従業員を削除
   *
   * @param id
   */
  async delete(id: string): Promise<void> {
    await prisma.employee.delete({
      where: { id: id },
    });
  }

  /**
   * idで従業員を検索
   *
   * @param id
   * @returns 従業員エンティティ（見つからない場合はnull）
   */
  async findById(id: string): Promise<Employee | null> {
    const prismaEmployee = await prisma.employee.findUnique({
      where: { id: id },
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
