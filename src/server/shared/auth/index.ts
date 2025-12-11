/**
 * 認証サービスの公開API
 *
 * フロントエンドからはこのモジュールを通じて認証機能を利用する。
 * 実装の詳細（Better Auth）は隠蔽される。
 */

export type {
  AuthSession,
  AuthUser,
  SignInInput,
  SignInResult,
  SignOutResult,
} from "./types";
export type { IAuthService } from "./IAuthService";

// デフォルトの認証サービスインスタンス
import { BetterAuthService } from "./better-auth/BetterAuthService";

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

