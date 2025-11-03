import { Role } from "@/domain/types/Role";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";
import { BusinessRuleViolationError } from "@/shared/errors/DomainError";

/**
 * 従業員エンティティ
 *
 * ビジネスルール：
 * - ログイン失敗が一定回数を超えるとアカウントがロックされる
 * - ロックされたアカウントは一定時間経過後に自動解除される
 */
export class Employee {
  /** エンティティ名（エラーメッセージ用） */
  static readonly ENTITY_NAME = "従業員";

  /** アカウントロックの閾値 */
  private static readonly MAX_FAILED_LOGIN_ATTEMPTS = 5;
  /** アカウントロック期間（ミリ秒） */
  private static readonly LOCK_DURATION_MS = 30 * 60 * 1000; // 30分

  private constructor(
    private readonly _id: string,
    private readonly _employeeCd: EmployeeCd,
    private _email: MailAddress,
    private _name: string,
    private _passwordHash: string,
    private _role: Role,
    private _failedLoginAttempts: number,
    private _lockedUntil: Date | null,
    private _lastLoginAt: Date | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規従業員を作成
   *
   * @param employeeCd 社員コード
   * @param email メールアドレス
   * @param name 氏名
   * @param passwordHash ハッシュ化済みパスワード
   * @param role 役割（デフォルト：USER）
   * @returns 従業員エンティティ
   *
   * 注意：パスワードのハッシュ化はアプリケーション層で行う
   */
  static create(
    employeeCd: EmployeeCd,
    email: MailAddress,
    name: string,
    passwordHash: string,
    role: Role = Role.USER
  ): Employee {
    const now = new Date();

    return new Employee(
      // TODO: よく考えたらこの実装が外部機能(Prisma)に依存してる。cuidはプログラム側で作るべき
      "", // idはPrismaが自動生成するため空文字
      employeeCd,
      email,
      name,
      passwordHash,
      role,
      0, // 初期値：ログイン失敗回数
      null, // 初期値：ロックなし
      null, // 初期値：最終ログイン日時なし
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
   * @param passwordHash ハッシュ化済みパスワード
   * @param role 役割
   * @param failedLoginAttempts ログイン失敗回数
   * @param lockedUntil アカウントロック期限
   * @param lastLoginAt 最終ログイン日時
   * @param createdAt 作成日時
   * @param updatedAt 更新日時
   * @returns 従業員エンティティ
   */
  static reconstruct(
    id: string,
    employeeCd: EmployeeCd,
    email: MailAddress,
    name: string,
    passwordHash: string,
    role: Role,
    failedLoginAttempts: number,
    lockedUntil: Date | null,
    lastLoginAt: Date | null,
    createdAt: Date,
    updatedAt: Date
  ): Employee {
    return new Employee(
      id,
      employeeCd,
      email,
      name,
      passwordHash,
      role,
      failedLoginAttempts,
      lockedUntil,
      lastLoginAt,
      createdAt,
      updatedAt
    );
  }

  // ========================================
  // ビジネスロジック
  // ========================================

  /**
   * アカウントがロックされているか判定
   *
   * @returns ロックされている場合true
   */
  isAccountLocked(): boolean {
    if (!this._lockedUntil) {
      return false;
    }

    const now = new Date();
    if (now >= this._lockedUntil) {
      // ロック期限切れの場合は自動的にロック解除
      this._lockedUntil = null;
      this._failedLoginAttempts = 0;
      return false;
    }

    return true;
  }

  /**
   * ログイン失敗を記録
   *
   * ビジネスルール：
   * - 失敗回数をインクリメント
   * - 閾値を超えた場合はアカウントをロック
   *
   * @throws {BusinessRuleViolationError} アカウントが既にロックされている場合
   */
  recordFailedLogin(): void {
    if (this.isAccountLocked()) {
      throw new BusinessRuleViolationError(
        `アカウントは ${this._lockedUntil!.toLocaleString()} までロックされています`
      );
    }

    this._failedLoginAttempts += 1;
    this._updatedAt = new Date();

    // 閾値を超えた場合はロック
    if (this._failedLoginAttempts >= Employee.MAX_FAILED_LOGIN_ATTEMPTS) {
      this._lockedUntil = new Date(Date.now() + Employee.LOCK_DURATION_MS);
    }
  }

  /**
   * ログイン成功時に失敗回数をリセット
   *
   * ビジネスルール：
   * - 最終ログイン日時を更新
   * - ログイン失敗回数をリセット
   * - ロックを解除
   */
  recordSuccessfulLogin(): void {
    this._lastLoginAt = new Date();
    this._failedLoginAttempts = 0;
    this._lockedUntil = null;
    this._updatedAt = new Date();
  }

  /**
   * アカウントロックを強制解除
   *
   * 管理者による手動ロック解除を想定
   */
  unlockAccount(): void {
    this._lockedUntil = null;
    this._failedLoginAttempts = 0;
    this._updatedAt = new Date();
  }

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
   * パスワードを変更
   *
   * @param newPasswordHash 新しいハッシュ化済みパスワード
   *
   * 注意：パスワードのハッシュ化はアプリケーション層で行う
   */
  changePassword(newPasswordHash: string): void {
    this._passwordHash = newPasswordHash;
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

  get passwordHash(): string {
    return this._passwordHash;
  }

  get role(): Role {
    return this._role;
  }

  get failedLoginAttempts(): number {
    return this._failedLoginAttempts;
  }

  get lockedUntil(): Date | null {
    return this._lockedUntil;
  }

  get lastLoginAt(): Date | null {
    return this._lastLoginAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
