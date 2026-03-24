import { EmployeeQueryService } from "@subdomains/employee/application/queries/EmployeeQueryService";
import { EmployeeDTO } from "@subdomains/employee/application/queries/dto/EmployeeDTO";

export type GetEmployeeByIdInput = {
  id: string;
};

/**
 * IDで従業員を取得するクエリ
 */
export class GetEmployeeByIdQuery {
  public constructor(private readonly employeeQueryService: EmployeeQueryService) {}

  async execute(input: GetEmployeeByIdInput): Promise<EmployeeDTO | null> {
    return await this.employeeQueryService.findById(input.id);
  }
}
