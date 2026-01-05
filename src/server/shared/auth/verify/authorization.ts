/**
 * 認可チェックヘルパー
 *
 * ユーザーの権限を確認する。
 * Server Action で認可チェックを行う際に使用する。
 * リダイレクト処理は呼び出し元（Server Action）で行うこと。
 *
 * @see learning/resource-based-authorization.md
 * @see learning/ddd-auth-layer-placement.md
 */

import { USER_ROLES, type AuthSession } from "../types";

/**
 * 管理者権限チェック
 *
 * セッションのユーザーが管理者であるかを確認する。
 *
 * @param session 認証済みセッション
 * @returns 管理者の場合は true
 *
 * @example
 * ```typescript
 * export async function createEmployee(...) {
 *   const session = await getSession();
 *   if (!session) {
 *     redirect(`/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`);
 *   }
 *   if (!isAdmin(session)) {
 *     redirect(`/signin?reason=${REDIRECT_REASON.FORBIDDEN}`);
 *   }
 *   // 管理者のみがここに到達
 * }
 * ```
 */
export function isAdmin(session: AuthSession): boolean {
  return session.user.role === USER_ROLES.ADMIN;
}

/**
 * リソース所有権チェック（本人チェック）
 *
 * セッションのユーザーが対象リソースの所有者であるかを確認する。
 *
 * @param session 認証済みセッション
 * @param resourceEmployeeId リソースの所有者の従業員ID
 * @returns 本人の場合は true
 *
 * @example
 * ```typescript
 * export async function updateEmployee(employeeId: string, ...) {
 *   const session = await getSession();
 *   if (!session) {
 *     redirect(`/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`);
 *   }
 *   if (!isOwner(session, employeeId) && !isAdmin(session)) {
 *     redirect(`/signin?reason=${REDIRECT_REASON.FORBIDDEN}`);
 *   }
 *   // 本人または管理者のみがここに到達
 * }
 * ```
 */
export function isOwner(
  session: AuthSession,
  resourceEmployeeId: string
): boolean {
  return session.user.employeeId === resourceEmployeeId;
}
