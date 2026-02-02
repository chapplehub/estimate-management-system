import type { UserManagementService } from "@server/shared/auth/UserManagementService";
import type { UserRole } from "@server/shared/auth/types";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { ValidationError } from "@server/shared/errors/DomainError";
import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeRepository } from "@subdomains/employee/domain/repositories/EmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@subdomains/employee/domain/services/EmployeeCdDuplicationCheckDomainService";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";

export type CreateEmployeeInput = {
  employeeCd: string;
  email: string;
  name: string;
  /** 所属部署ID */
  departmentId: string;
  /** ユーザーロール（"admin" | "user"） - User.roleに設定 */
  role: UserRole;
  /** 認証用パスワード（better-auth User作成用） */
  password: string;
};

/**
 * 従業員新規登録コマンド
 *
 * Employee（ドメインエンティティ）と認証ユーザー（better-auth User/Account）を同時に作成する。
 * 認証ユーザーの作成に失敗した場合、Employeeも削除してロールバックする。
 */
export class CreateEmployeeCommand {
  public constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly employeeCdDuplicationCheckDomainService: EmployeeCdDuplicationCheckDomainService,
    private readonly mailAddressDuplicationCheckDomainService: MailAddressDuplicationCheckDomainService,
    private readonly userManagementService: UserManagementService
  ) {}

  async execute(input: CreateEmployeeInput): Promise<void> {
    const employeeCd = new EmployeeCd(input.employeeCd);
    const mailAddress = new MailAddress(input.email);

    // 従業員コードの重複チェック
    const isCdDuplicated = await this.employeeCdDuplicationCheckDomainService.execute(employeeCd);
    if (isCdDuplicated) {
      throw new ValidationError(`既に存在する従業員CDです: CD=${employeeCd}`);
    }

    // メールアドレスの重複チェック
    const isEmailDuplicated =
      await this.mailAddressDuplicationCheckDomainService.execute(mailAddress);
    if (isEmailDuplicated) {
      throw new ValidationError(`既に存在するメールアドレスです: Email=${mailAddress.value}`);
    }

    const employeeName = new EmployeeName(input.name);
    const newEmployee = Employee.create(employeeCd, mailAddress, employeeName, input.departmentId);

    // Employee を保存
    await this.employeeRepository.save(newEmployee);

    // 認証ユーザー（User/Account）を作成（roleはUser側で管理）
    const userResult = await this.userManagementService.createUser({
      email: input.email,
      password: input.password,
      name: input.name,
      employeeId: newEmployee.id,
      role: input.role,
    });

    // 認証ユーザーの作成に失敗した場合、Employeeを削除してロールバック
    if (!userResult.success) {
      await this.employeeRepository.delete(newEmployee.id);
      throw new ValidationError(`認証ユーザーの作成に失敗しました: ${userResult.error}`);
    }
  }
}
