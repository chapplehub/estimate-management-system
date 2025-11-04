import { IEmployeeQueryService } from "@/domain/queries/IEmployeeQueryService";
import { EmployeeDTO } from "@/domain/queries/dto/EmployeeDTO";

export type GetEmployeeByEmailInput = {
  email: string;
};

/**
 * メールアドレスで従業員を取得するクエリ
 */
export class GetEmployeeByEmailQuery {
  public constructor(
    private readonly employeeQueryService: IEmployeeQueryService
  ) {}

  async execute(input: GetEmployeeByEmailInput): Promise<EmployeeDTO | null> {
    return await this.employeeQueryService.findByEmail(input.email);
  }
}
