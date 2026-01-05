import type { UserRole } from "./types";

/**
 * ユーザー管理サービスのインターフェース
 *
 * 認証ユーザー（User/Account）の管理機能を抽象化し、
 * 実装の詳細（Better Auth Admin API等）を隠蔽する。
 *
 * Employee（ドメインエンティティ）と認証ユーザーの同期に使用する。
 */

// ========================================
// 型定義
// ========================================

/**
 * 認証ユーザー作成の入力
 */
export type CreateAuthUserInput = {
  /** メールアドレス */
  email: string;
  /** パスワード（平文、ハッシュ化は実装側で行う） */
  password: string;
  /** ユーザー名 */
  name: string;
  /** 紐づけるEmployeeのID */
  employeeId: string;
  /** ユーザーロール（"admin" | "user"） */
  role: UserRole;
};

/**
 * 認証ユーザー作成の結果
 */
export type CreateAuthUserResult =
  | { success: true; userId: string }
  | { success: false; error: string };

/**
 * 認証ユーザーのemail更新の結果
 */
export type UpdateAuthUserEmailResult =
  | { success: true }
  | { success: false; error: string };

/**
 * 認証ユーザー削除の結果
 */
export type RemoveAuthUserResult =
  | { success: true }
  | { success: false; error: string };

/**
 * 認証ユーザーのrole更新の結果
 */
export type UpdateAuthUserRoleResult =
  | { success: true }
  | { success: false; error: string };

// ========================================
// インターフェース
// ========================================

export interface IUserManagementService {
  /**
   * 認証ユーザー（User/Account）を作成する
   *
   * @param input 作成情報
   * @returns 作成結果（成功時はuserId、失敗時はエラーメッセージ）
   */
  createUser(input: CreateAuthUserInput): Promise<CreateAuthUserResult>;

  /**
   * 認証ユーザーのメールアドレスを更新する
   *
   * @param userId 更新対象のユーザーID
   * @param newEmail 新しいメールアドレス
   * @returns 更新結果
   */
  updateUserEmail(
    userId: string,
    newEmail: string
  ): Promise<UpdateAuthUserEmailResult>;

  /**
   * 認証ユーザーを削除する
   * Account/Sessionも同時に削除される（カスケード削除）
   *
   * @param userId 削除対象のユーザーID
   * @returns 削除結果
   */
  removeUser(userId: string): Promise<RemoveAuthUserResult>;

  /**
   * EmployeeIDから紐づく認証ユーザーを検索する
   *
   * @param employeeId 従業員ID
   * @returns ユーザー情報（存在しない場合はnull）
   */
  findUserByEmployeeId(employeeId: string): Promise<{ id: string } | null>;

  /**
   * 認証ユーザーのロールを更新する
   *
   * @param userId 更新対象のユーザーID
   * @param role 新しいロール（"admin" | "user"）
   * @returns 更新結果
   */
  updateUserRole(
    userId: string,
    role: UserRole
  ): Promise<UpdateAuthUserRoleResult>;
}
