import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { EmployeeCd } from "@/domain/value/EmployeeCd";

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
