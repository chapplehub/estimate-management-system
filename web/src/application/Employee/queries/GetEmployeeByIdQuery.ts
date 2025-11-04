import { IEmployeeQueryService } from "@/domain/queries/IEmployeeQueryService";
import { EmployeeDTO } from "@/domain/queries/dto/EmployeeDTO";

export type GetEmployeeByIdInput = {
  id: string;
};

/**
 * IDで従業員を取得するクエリ
 */
export class GetEmployeeByIdQuery {
  public constructor(
    private readonly employeeQueryService: IEmployeeQueryService
  ) {}

  async execute(input: GetEmployeeByIdInput): Promise<EmployeeDTO | null> {
    return await this.employeeQueryService.findById(input.id);
  }
}
