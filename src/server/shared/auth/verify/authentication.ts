/**
 * 認証検証ヘルパー（DALパターン）
 *
 * ログイン済みであることを確認する。
 * Server Action で認証チェックを行う際に使用する。
 *
 * @see learning/server-action-auth-patterns.md
 */

import { redirect } from "next/navigation";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { getCurrentSession } from "../index";
import type { AuthSession } from "../types";

/**
 * セッション検証（認証のみ）
 *
 * ログイン済みであることを確認する。
 * 未ログインの場合はサインインページにリダイレクトする。
 *
 * @returns 検証済みセッション
 * @throws redirect() - 未ログインの場合
 *
 * @example
 * ```typescript
 * export async function someAction() {
 *   const session = await verifySession();
 *   // session.user.id, session.user.employeeId などが利用可能
 * }
 * ```
 */
export async function verifySession(): Promise<AuthSession> {
  const session = await getCurrentSession();

  if (!session) {
    redirect(`/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`);
  }

  return session;
}
