import { Employee } from "@/domain/entities/Employee";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";

export interface IEmployeeRepository {
  save(employee: Employee): Promise<void>;
  update(employee: Employee): Promise<void>;
  delete(employeeCd: EmployeeCd): Promise<void>;
  find(employeeCd: EmployeeCd): Promise<Employee | null>;
  findAll(): Promise<Array<Employee>>;
}
