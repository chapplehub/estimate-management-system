import { Employee } from "@/domain/entities/Employee";
import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";

export class InMemoryEmployeeRepository implements IEmployeeRepository {
  public DB: {
    [EmployeeCd: string]: Employee;
  } = {};

  async save(Employee: Employee) {
    this.DB[Employee.employeeCd.value] = Employee;
  }

  async update(Employee: Employee) {
    this.DB[Employee.employeeCd.value] = Employee;
  }

  async delete(EmployeeCd: EmployeeCd) {
    delete this.DB[EmployeeCd.value];
  }

  async find(EmployeeCd: EmployeeCd): Promise<Employee | null> {
    const Employee = Object.entries(this.DB).find(([id]) => {
      return EmployeeCd.value === id.toString();
    });

    return Employee ? Employee[1] : null;
  }

  async findAll(): Promise<Array<Employee>> {
    return [];
  }
}
