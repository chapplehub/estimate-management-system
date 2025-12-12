/**
 * 認証検証ヘルパー（DALパターン）
 *
 * ログイン済みであることを確認する。
 * Server Action で認証チェックを行う際に使用する。
 *
 * @see learning/server-action-auth-patterns.md
 */

import { unauthorized } from "next/navigation";
import { getCurrentSession } from "../index";
import type { AuthSession } from "../types";

/**
 * セッション検証（認証のみ）
 *
 * ログイン済みであることを確認する。
 * 未ログインの場合は 401 を返す。
 *
 * @returns 検証済みセッション
 * @throws unauthorized() - 未ログインの場合
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
    unauthorized();
  }

  return session;
}
