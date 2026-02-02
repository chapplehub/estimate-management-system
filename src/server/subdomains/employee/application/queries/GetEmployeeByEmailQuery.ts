import { EmployeeQueryService } from "@subdomains/employee/application/queries/EmployeeQueryService";
import { EmployeeDTO } from "@subdomains/employee/application/queries/dto/EmployeeDTO";

export type GetEmployeeByEmailInput = {
  email: string;
};

/**
 * メールアドレスで従業員を取得するクエリ
 */
export class GetEmployeeByEmailQuery {
  public constructor(private readonly employeeQueryService: EmployeeQueryService) {}

  async execute(input: GetEmployeeByEmailInput): Promise<EmployeeDTO | null> {
    return await this.employeeQueryService.findByEmail(input.email);
  }
}
