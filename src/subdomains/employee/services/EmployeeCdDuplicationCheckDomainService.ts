import { IEmployeeRepository } from "@/subdomains/employee/repositories/IEmployeeRepository";
import { EmployeeCd } from "@/subdomains/employee/values/EmployeeCd";

export class EmployeeCdDuplicationCheckDomainService {
  constructor(private employeeRepository: IEmployeeRepository) {}

  async execute(employeeCd: EmployeeCd): Promise<boolean> {
    const duplicatedEmployee = await this.employeeRepository.findByEmployeeCd(
      employeeCd
    );
    const isDuplicated = !!duplicatedEmployee;

    return isDuplicated;
  }
}
