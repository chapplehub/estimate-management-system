import type { UserManagementService } from "@server/shared/auth/UserManagementService";
import type { UserRole } from "@server/shared/auth/types";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { ValidationError } from "@server/shared/errors/DomainError";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeRepository } from "@subdomains/employee/domain/repositories/EmployeeRepository";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { SuperiorRoleKachouTierValidationDomainService } from "@subdomains/role/domain/services/SuperiorRoleKachouTierValidationDomainService";
import { RoleId } from "@subdomains/role/domain/values/RoleId";

export type UpdateEmployeeInput = {
  id: string;
  employeeCd: string;
  /** 編集画面表示時の version（楽観ロックトークン / ADR-0039）。リポジトリへ素通しする。 */
  expectedVersion: number;
  email: string;
  name: string;
  /** 所属部署ID */
  departmentId: string;
  /** ユーザーロール（"admin" | "user"） - User.roleを更新 */
  role: UserRole;
  /**
   * 担当役割ID。フォームが送る「次の状態」で上書きする（置換・解除）。
   * 未指定は解除（役割なし＝課員）を意味する。割当先の存在検証は行わず FK に委ねる。
   */
  roleId?: string;
  /**
   * 課員の明示上位役割ID（承認起点・ADR-20260707-k4e）。フォームが送る「次の状態」で
   * 上書きする（設定・解除）。課員のみ有効で課長級に限る。roleId 指定時は役割から
   * 上位役割を導出するため無視する（正規化）。
   */
  superiorRoleId?: string;
};

/**
 * 従業員情報変更コマンド
 *
 * Employee の情報を更新し、email が変更された場合は認証ユーザーの email も同期する。
 */
export class UpdateEmployeeCommand {
  public constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly mailAddressDuplicationCheckDomainService: MailAddressDuplicationCheckDomainService,
    private readonly userManagementService: UserManagementService,
    private readonly superiorRoleKachouTierValidationDomainService: SuperiorRoleKachouTierValidationDomainService
  ) {}

  async execute(input: UpdateEmployeeInput): Promise<void> {
    const employeeId = new EmployeeId(input.id);
    const targetEmployee = await this.employeeRepository.findById(employeeId);
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
        await this.mailAddressDuplicationCheckDomainService.execute(newMailAddress);
      if (isDuplicated) {
        throw new ValidationError(`既に存在するメールアドレスです: Email=${newMailAddress.value}`);
      }
    }

    // 上位役割の正規化: 役割持ちは担当役割から導出するため明示値は無視する（I1）。
    // 課員のときのみ明示上位役割を受け取り、課長級であることを検証する。
    const nextAssignedRoleId = input.roleId ? new RoleId(input.roleId) : null;
    const nextSuperiorRoleId =
      nextAssignedRoleId === null && input.superiorRoleId ? new RoleId(input.superiorRoleId) : null;
    if (nextSuperiorRoleId) {
      await this.superiorRoleKachouTierValidationDomainService.execute(nextSuperiorRoleId);
    }

    targetEmployee.changeName(new EmployeeName(input.name));
    targetEmployee.changeEmail(newMailAddress);
    targetEmployee.changeDepartment(new DepartmentId(input.departmentId));
    // フォームが送る「次の状態」で担当役割を上書き（未指定＝解除）。
    // changeRole は役割付与時に明示上位役割を自動クリアするため、role→superior の順に呼ぶ。
    targetEmployee.changeRole(nextAssignedRoleId);
    targetEmployee.changeSuperiorRole(nextSuperiorRoleId);

    // 注意: この条件付き UPDATE（楽観ロック / ADR-0039）が後続の User 同期より先に走る順序が、
    // User.email/role を employee の version で間接的に守る前提になっている。
    // stale なフォームはここで ConflictError になり User 同期に到達しない（集約境界の再設計は #317）。
    await this.employeeRepository.update(targetEmployee, input.expectedVersion);

    // 認証ユーザーの更新（email, role）
    const user = await this.userManagementService.findUserByEmployeeId(input.id);
    if (user) {
      // email が変更された場合、認証ユーザーの email も同期
      if (isEmailChanged) {
        const emailResult = await this.userManagementService.updateUserEmail(user.id, input.email);
        if (!emailResult.success) {
          // 認証ユーザーの更新に失敗してもEmployeeは更新済み
          // 一貫性の問題があるが、ログで警告を出すに留める
          // TODO: userとemployeeは整合性と保たなければならないので集約を考える必要がある。
          console.error(`認証ユーザーのemail更新に失敗しました: ${emailResult.error}`);
        }
      }

      // User.role を更新
      const roleResult = await this.userManagementService.updateUserRole(user.id, input.role);
      if (!roleResult.success) {
        console.error(`認証ユーザーのrole更新に失敗しました: ${roleResult.error}`);
      }
    }
  }
}
