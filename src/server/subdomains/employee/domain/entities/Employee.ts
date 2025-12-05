import { createId } from "@paralleldrive/cuid2";
import { Role } from "@subdomains/employee/domain/types/Role";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { MailAddress } from "@server/shared/domain/values/MailAddress";

/**
 * 従業員エンティティ
 *
 * 業務ドメインにおける従業員を表す。
 * 認証関連の責務は better-auth (User/Account) に委譲。
 */
export class Employee {
  /** エンティティ名（エラーメッセージ用） */
  static readonly ENTITY_NAME = "従業員";

  private constructor(
    private readonly _id: string,
    private readonly _employeeCd: EmployeeCd,
    private _email: MailAddress,
    private _name: string,
    private _role: Role,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規従業員を作成
   *
   * @param employeeCd 社員コード
   * @param email メールアドレス
   * @param name 氏名
   * @param role 役割（デフォルト：USER）
   * @returns 従業員エンティティ
   */
  static create(
    employeeCd: EmployeeCd,
    email: MailAddress,
    name: string,
    role: Role = Role.USER
  ): Employee {
    const now = new Date();

    return new Employee(
      createId(), // CUIDを生成
      employeeCd,
      email,
      name,
      role,
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
   * @param role 役割
   * @param createdAt 作成日時
   * @param updatedAt 更新日時
   * @returns 従業員エンティティ
   */
  static reconstruct(
    id: string,
    employeeCd: EmployeeCd,
    email: MailAddress,
    name: string,
    role: Role,
    createdAt: Date,
    updatedAt: Date
  ): Employee {
    return new Employee(id, employeeCd, email, name, role, createdAt, updatedAt);
  }

  // ========================================
  // ビジネスロジック
  // ========================================

  /**
   * 名前を変更
   *
   * @param newName
   */
  changeName(newName: string): void {
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
   * 役割を変更
   *
   * @param newRole
   */
  changeRole(newRole: Role): void {
    this._role = newRole;
    this._updatedAt = new Date();
  }

  /**
   * 管理者かどうか判定
   *
   * @returns 管理者の場合true
   */
  isAdmin(): boolean {
    return this._role === Role.ADMIN;
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): string {
    return this._id;
  }

  get employeeCd(): EmployeeCd {
    return this._employeeCd;
  }

  get email(): MailAddress {
    return this._email;
  }

  get name(): string {
    return this._name;
  }

  get role(): Role {
    return this._role;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
