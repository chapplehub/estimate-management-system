import { Employee } from "@/subdomains/employee/entities/Employee";
import { IEmployeeRepository } from "@/subdomains/employee/repositories/IEmployeeRepository";
import { EmployeeCd } from "@/subdomains/employee/values/EmployeeCd";
import { MailAddress } from "@/shared/domain/values/MailAddress";
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

  async findByEmail(email: MailAddress): Promise<Employee | null> {
    const employee = Object.values(this.DB).find((emp) =>
      emp.email.equals(email)
    );

    return employee || null;
  }
}
