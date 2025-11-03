import { Employee } from "@/domain/entities/Employee";
import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { randomUUID } from "crypto";

export class InMemoryEmployeeRepository implements IEmployeeRepository {
  public DB: {
    [id: string]: Employee;
  } = {};

  async save(employee: Employee): Promise<Employee> {
    // IDが空文字の場合は生成する（createで作成された場合）
    if (!employee.id) {
      const id = randomUUID();
      // プライベートフィールドにアクセスできないため、reconstructで再作成
      const newEmployee = Employee.reconstruct(
        id,
        employee.employeeCd,
        employee.email,
        employee.name,
        employee.passwordHash,
        employee.role,
        employee.failedLoginAttempts,
        employee.lockedUntil,
        employee.lastLoginAt,
        employee.createdAt,
        employee.updatedAt
      );
      this.DB[id] = newEmployee;
      return newEmployee;
    } else {
      this.DB[employee.id] = employee;
      return employee;
    }
  }

  async delete(id: string) {
    delete this.DB[id];
  }

  async findById(id: string): Promise<Employee | null> {
    return this.DB[id] || null;
  }

  async findByEmployeeCd(employeeCd: EmployeeCd): Promise<Employee | null> {
    const employee = Object.values(this.DB).find((emp) =>
      emp.employeeCd.equals(employeeCd)
    );

    return employee || null;
  }

  async findAll(): Promise<Array<Employee>> {
    return Object.values(this.DB);
  }
}
