import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";

/**
 * 従業員エンティティ
 *
 * 業務ドメインにおける従業員を表す。
 * 認証関連の責務（パスワード等）は better-auth (User/Account) に委譲。
 * 担当役割は多対多スキーマ（EmployeeRole）を維持しつつ、集約では高々1件の
 * `RoleId | null` として保持する（ADR-20260706-c89）。役割なし（課員）は null。
 */
export class Employee {
  /** エンティティ名（エラーメッセージ用） */
  static readonly ENTITY_NAME = "従業員";

  private constructor(
    private readonly _id: EmployeeId,
    private readonly _employeeCd: EmployeeCd,
    private _email: MailAddress,
    private _name: EmployeeName,
    private _departmentId: DepartmentId,
    private _assignedRoleId: RoleId | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規従業員を作成
   *
   * @param employeeCd 社員コード
   * @param email メールアドレス
   * @param name 氏名
   * @param departmentId 所属部署ID
   * @param assignedRoleId 担当役割ID（省略時は役割なし＝課員）
   * @returns 従業員エンティティ
   */
  static create(
    employeeCd: EmployeeCd,
    email: MailAddress,
    name: EmployeeName,
    departmentId: DepartmentId,
    assignedRoleId: RoleId | null = null
  ): Employee {
    const now = new Date();

    return new Employee(
      EmployeeId.generate(),
      employeeCd,
      email,
      name,
      departmentId,
      assignedRoleId,
      now,
      now
    );
  }

  /**
   * DBから従業員を再構築
   *
   * @param id ID（CUID）
   * @param employeeCd 社員コード
   * @param email メールアドレス
   * @param name 氏名
   * @param departmentId 所属部署ID
   * @param assignedRoleId 担当役割ID（役割なしは null）
   * @param createdAt 作成日時
   * @param updatedAt 更新日時
   * @returns 従業員エンティティ
   */
  static reconstruct(
    id: EmployeeId,
    employeeCd: EmployeeCd,
    email: MailAddress,
    name: EmployeeName,
    departmentId: DepartmentId,
    assignedRoleId: RoleId | null,
    createdAt: Date,
    updatedAt: Date
  ): Employee {
    return new Employee(
      id,
      employeeCd,
      email,
      name,
      departmentId,
      assignedRoleId,
      createdAt,
      updatedAt
    );
  }

  // ========================================
  // ビジネスロジック
  // ========================================

  /**
   * 名前を変更
   *
   * @param newName
   */
  changeName(newName: EmployeeName): void {
    this._name = newName;
    this._updatedAt = new Date();
  }

  /**
   * メールアドレスを変更
   *
   * @param newEmail
   */
  changeEmail(newEmail: MailAddress): void {
    this._email = newEmail;
    this._updatedAt = new Date();
  }

  /**
   * 所属部署を変更
   *
   * @param newDepartmentId 新しい部署ID
   */
  changeDepartment(newDepartmentId: DepartmentId): void {
    this._departmentId = newDepartmentId;
    this._updatedAt = new Date();
  }

  /**
   * 担当役割を変更する（割当・置換・解除を一元的に扱う）
   *
   * 高々1件の担当役割を「次の状態」で上書きする。
   * - RoleId を渡す: 割当 or 別役割への置換
   * - null を渡す: 解除（役割なし＝課員）
   *
   * @param newRoleId 新しい担当役割ID（解除する場合は null）
   */
  changeRole(newRoleId: RoleId | null): void {
    this._assignedRoleId = newRoleId;
    this._updatedAt = new Date();
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): EmployeeId {
    return this._id;
  }

  get employeeCd(): EmployeeCd {
    return this._employeeCd;
  }

  get email(): MailAddress {
    return this._email;
  }

  get name(): EmployeeName {
    return this._name;
  }

  get departmentId(): DepartmentId {
    return this._departmentId;
  }

  /** 担当役割ID（役割なし＝課員は null） */
  get assignedRoleId(): RoleId | null {
    return this._assignedRoleId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
