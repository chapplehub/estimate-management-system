import { Employee } from "@/domain/entities/Employee";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";

export interface IEmployeeRepository {
  save(employee: Employee): Promise<Employee>;
  delete(id: string): Promise<void>;
  findById(id: string): Promise<Employee | null>;
  findByEmployeeCd(employeeCd: EmployeeCd): Promise<Employee | null>;
  findByEmail(email: MailAddress): Promise<Employee | null>;
  findAll(): Promise<Array<Employee>>;
}
