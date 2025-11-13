import { NotFoundEntityError } from "@/shared/errors/ApplicationError";
import { Employee } from "@/subdomains/employee/entities/Employee";
import { IEmployeeRepository } from "@/subdomains/employee/repositories/IEmployeeRepository";

export type DeleteEmployeeInput = {
  id: string;
};

/**
 * 従業員情報削除コマンド
 */
export class DeleteEmployeeCommand {
  public constructor(
    private readonly employeeRepository: IEmployeeRepository
  ) {}

  async execute(input: DeleteEmployeeInput): Promise<void> {
    const targetEmployee = await this.employeeRepository.findById(input.id);
    if (!targetEmployee) {
      throw new NotFoundEntityError(Employee, {
        id: input.id,
      });
    }

    await this.employeeRepository.delete(input.id);
  }
}
