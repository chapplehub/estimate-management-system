/**
 * 認証サービスの公開API
 *
 * フロントエンドからはこのモジュールを通じて認証機能を利用する。
 * 実装の詳細（Better Auth）は隠蔽される。
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";

export type { IAuthService } from "./IAuthService";
export type {
  AuthSession,
  AuthUser,
  SignInInput,
  SignInResult,
  SignOutResult,
} from "./types";
import type { AuthSession } from "./types";

// 認可チェックヘルパー関数
export { isAdmin, isOwner } from "./verify/authorization";

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
 * 認証済みセッションを取得する（null を返さない）
 *
 * proxy を通過後のページ・Server Action から呼び出す。
 * 同一リクエスト内で複数回呼んでも cache() により1回だけ実行される。
 * 万が一セッションがない場合はサインインページにリダイレクト。
 *
 * @returns AuthSession（null なし）
 */
export const getRequiredSession = cache(async (): Promise<AuthSession> => {
  const session = await authService.getCurrentSession();
  if (!session) {
    // proxy を通過しているはずなので、ここに来るのは異常系
    redirect(`/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`);
  }
  return session;
});

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
