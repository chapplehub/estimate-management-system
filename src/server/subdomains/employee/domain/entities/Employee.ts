import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";

/**
 * 従業員エンティティ
 *
 * 業務ドメインにおける従業員を表す。
 * 認証関連の責務（パスワード等）は better-auth (User/Account) に委譲。
 * 担当役割は多対多スキーマ（EmployeeRole）を維持しつつ、集約では高々1件の
 * `RoleId | null` として保持する（ADR-20260706-c89）。役割なし（課員）は null。
 *
 * 上位役割（承認フローの起点・ADR-20260707-k4e）は次の二源から成る：
 * - 役割持ち: 担当役割から読み取り時導出する（集約は保持しない）
 * - 課員    : 明示値 `_explicitSuperiorRoleId` を保持する（子表 EmployeeSuperiorRole へ抽出）
 * 不変条件 I1「担当役割あり ⇒ 明示上位役割なし」を集約が構造的に強制する。
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
    private _explicitSuperiorRoleId: RoleId | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {
    // I1: 担当役割と明示上位役割は両立しない（役割持ちの上位役割は導出するため）
    if (_assignedRoleId !== null && _explicitSuperiorRoleId !== null) {
      throw new BusinessRuleViolationError(
        "担当役割を持つ従業員に上位役割を明示できません（上位役割は担当役割から導出されます）"
      );
    }
  }

  /**
   * 新規従業員を作成
   *
   * @param employeeCd 社員コード
   * @param email メールアドレス
   * @param name 氏名
   * @param departmentId 所属部署ID
   * @param assignedRoleId 担当役割ID（省略時は役割なし＝課員）
   * @param explicitSuperiorRoleId 課員の明示上位役割ID（省略時は未設定）。担当役割と同時指定は I1 違反
   * @returns 従業員エンティティ
   */
  static create(
    employeeCd: EmployeeCd,
    email: MailAddress,
    name: EmployeeName,
    departmentId: DepartmentId,
    assignedRoleId: RoleId | null = null,
    explicitSuperiorRoleId: RoleId | null = null
  ): Employee {
    const now = new Date();

    return new Employee(
      EmployeeId.generate(),
      employeeCd,
      email,
      name,
      departmentId,
      assignedRoleId,
      explicitSuperiorRoleId,
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
   * @param explicitSuperiorRoleId 課員の明示上位役割ID（未設定・役割持ちは null）
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
    explicitSuperiorRoleId: RoleId | null,
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
      explicitSuperiorRoleId,
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
    // I1: 担当役割が付いたら明示上位役割は導出に切り替わるため自動クリアする
    if (newRoleId !== null) {
      this._explicitSuperiorRoleId = null;
    }
    this._updatedAt = new Date();
  }

  /**
   * 課員の明示上位役割を変更する（設定・置換・解除を一元的に扱う）
   *
   * 承認フローの起点を課員に明示する。役割持ちの上位役割は担当役割から導出するため、
   * 役割持ちに非 null を設定しようとすると I1 違反として弾く（null 解除は常に許す）。
   *
   * @param newSuperiorRoleId 新しい上位役割ID（解除する場合は null）
   * @throws BusinessRuleViolationError 担当役割を持つ従業員に非 null を設定しようとした場合
   */
  changeSuperiorRole(newSuperiorRoleId: RoleId | null): void {
    if (newSuperiorRoleId !== null && this._assignedRoleId !== null) {
      throw new BusinessRuleViolationError(
        "担当役割を持つ従業員に上位役割を明示できません（上位役割は担当役割から導出されます）"
      );
    }
    this._explicitSuperiorRoleId = newSuperiorRoleId;
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

  /**
   * 課員の明示上位役割ID（未設定・役割持ちは null）
   *
   * 役割持ちの上位役割はここには現れない（担当役割から導出するため）。承認起点の
   * 読み取りは EmployeeQueryService.findSuperiorRoleId が両源を統合して行う。
   */
  get explicitSuperiorRoleId(): RoleId | null {
    return this._explicitSuperiorRoleId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
