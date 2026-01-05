import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { IEmployeeRepository } from "@subdomains/employee/domain/repositories/IEmployeeRepository";
import type { IUserManagementService } from "@server/shared/auth/IUserManagementService";

export type DeleteEmployeeInput = {
  id: string;
};

/**
 * 従業員情報削除コマンド
 *
 * Employee（ドメインエンティティ）と認証ユーザー（better-auth User/Account）を同時に削除する。
 * 認証ユーザーは Employee に紐づいている場合のみ削除される。
 */
export class DeleteEmployeeCommand {
  public constructor(
    private readonly employeeRepository: IEmployeeRepository,
    private readonly userManagementService: IUserManagementService
  ) {}

  async execute(input: DeleteEmployeeInput): Promise<void> {
    const targetEmployee = await this.employeeRepository.findById(input.id);
    if (!targetEmployee) {
      throw new NotFoundEntityError(Employee, {
        id: input.id,
      });
    }

    // 関連する認証ユーザーを削除（存在する場合のみ）
    const user = await this.userManagementService.findUserByEmployeeId(
      input.id
    );
    if (user) {
      const removeResult = await this.userManagementService.removeUser(user.id);
      if (!removeResult.success) {
        throw new Error(
          `認証ユーザーの削除に失敗しました: ${removeResult.error}`
        );
      }
    }

    // Employee を削除
    await this.employeeRepository.delete(input.id);
  }
}
