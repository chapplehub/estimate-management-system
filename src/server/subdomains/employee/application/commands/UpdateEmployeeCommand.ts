import type { IUserManagementService } from "@server/shared/auth/IUserManagementService";
import type { UserRole } from "@server/shared/auth/types";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { ValidationError } from "@server/shared/errors/DomainError";
import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { IEmployeeRepository } from "@subdomains/employee/domain/repositories/IEmployeeRepository";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";

export type UpdateEmployeeInput = {
  id: string;
  employeeCd: string;
  email: string;
  name: string;
  /** ユーザーロール（"admin" | "user"） - User.roleを更新 */
  role: UserRole;
};

/**
 * 従業員情報変更コマンド
 *
 * Employee の情報を更新し、email が変更された場合は認証ユーザーの email も同期する。
 */
export class UpdateEmployeeCommand {
  public constructor(
    private readonly employeeRepository: IEmployeeRepository,
    private readonly mailAddressDuplicationCheckDomainService: MailAddressDuplicationCheckDomainService,
    private readonly userManagementService: IUserManagementService
  ) {}

  async execute(input: UpdateEmployeeInput): Promise<void> {
    const targetEmployee = await this.employeeRepository.findById(input.id);
    if (!targetEmployee) {
      throw new NotFoundEntityError(Employee, {
        employeeCd: input.employeeCd,
      });
    }

    const newMailAddress = new MailAddress(input.email);
    const isEmailChanged = !targetEmployee.email.equals(newMailAddress);

    // メールアドレスが変更される場合のみ重複チェック
    if (isEmailChanged) {
      const isDuplicated =
        await this.mailAddressDuplicationCheckDomainService.execute(
          newMailAddress
        );
      if (isDuplicated) {
        throw new ValidationError(
          `既に存在するメールアドレスです: Email=${newMailAddress.value}`
        );
      }
    }

    targetEmployee.changeName(input.name);
    targetEmployee.changeEmail(newMailAddress);

    await this.employeeRepository.save(targetEmployee);

    // 認証ユーザーの更新（email, role）
    const user = await this.userManagementService.findUserByEmployeeId(
      input.id
    );
    if (user) {
      // email が変更された場合、認証ユーザーの email も同期
      if (isEmailChanged) {
        const emailResult = await this.userManagementService.updateUserEmail(
          user.id,
          input.email
        );
        if (!emailResult.success) {
          // 認証ユーザーの更新に失敗してもEmployeeは更新済み
          // 一貫性の問題があるが、ログで警告を出すに留める
          // TODO: userとemployeeは整合性と保たなければならないので集約を考える必要がある。
          console.error(
            `認証ユーザーのemail更新に失敗しました: ${emailResult.error}`
          );
        }
      }

      // User.role を更新
      const roleResult = await this.userManagementService.updateUserRole(
        user.id,
        input.role
      );
      if (!roleResult.success) {
        console.error(
          `認証ユーザーのrole更新に失敗しました: ${roleResult.error}`
        );
      }
    }
  }
}
