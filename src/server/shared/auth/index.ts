/**
 * 認証サービスの公開API
 *
 * フロントエンドからはこのモジュールを通じて認証機能を利用する。
 * 実装の詳細（Better Auth）は隠蔽される。
 */

export type { IAuthService } from "./IAuthService";
export type { IUserManagementService } from "./IUserManagementService";
export type {
  CreateAuthUserInput,
  CreateAuthUserResult,
  RemoveAuthUserResult,
  UpdateAuthUserEmailResult,
} from "./IUserManagementService";
export type { AuthSession, AuthUser, SignInInput, SignInResult, SignOutResult } from "./types";

// 認可チェックヘルパー関数
export { isAdmin, isOwner } from "./verify/authorization";

// デフォルトの認証サービスインスタンス
import { BetterAuthService } from "./better-auth/BetterAuthService";
// ユーザー管理サービスのエクスポート
export { BetterAuthUserManagementService } from "./better-auth/BetterAuthUserManagementService";

const authService = new BetterAuthService();

/**
 * 現在のセッションを取得する
 * Server Component / Server Action から呼び出す
 */
export async function getCurrentSession() {
  return authService.getCurrentSession();
}

/**
 * メールアドレスとパスワードでサインインする
 */
export async function signIn(input: { email: string; password: string }) {
  return authService.signIn(input);
}

/**
 * サインアウトする
 */
export async function signOut() {
  return authService.signOut();
}
