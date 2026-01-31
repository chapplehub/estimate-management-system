import type { AuthSession, SignInInput, SignInResult, SignOutResult } from "./types";

/**
 * 認証サービスのインターフェース
 *
 * 認証機能の抽象化を提供し、実装の詳細（Better Auth等）を隠蔽する
 */
export interface IAuthService {
  /**
   * 現在のセッションを取得する
   * Server Component / Server Action から呼び出す
   *
   * @returns セッション情報（未認証の場合はnull）
   */
  getCurrentSession(): Promise<AuthSession | null>;

  /**
   * メールアドレスとパスワードでサインインする
   *
   * @param input サインイン情報
   * @returns サインイン結果
   */
  signIn(input: SignInInput): Promise<SignInResult>;

  /**
   * サインアウトする
   *
   * @returns サインアウト結果
   */
  signOut(): Promise<SignOutResult>;
}
