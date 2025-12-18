/**
 * 認可検証ヘルパー（DALパターン）
 *
 * ユーザーの権限を確認する。
 * Server Action で認可チェックを行う際に使用する。
 *
 * @see learning/resource-based-authorization.md
 * @see learning/ddd-auth-layer-placement.md
 */

import { unauthorized } from "next/navigation";
import type { AuthSession } from "../types";

/**
 * 管理者権限を検証（認可のみ）
 *
 * セッションのユーザーが管理者であることを確認する。
 * 認証チェック（verifySession）は呼び出し元で行うこと。
 *
 * @param session 認証済みセッション
 * @throws unauthorized() - 管理者でない場合
 *
 * @example
 * ```typescript
 * export async function createEmployee(...) {
 *   const session = await verifySession(); // 認証
 *   await verifyAdmin(session);            // 認可
 *   // 管理者のみがここに到達
 * }
 * ```
 */
export async function verifyAdmin(session: AuthSession): Promise<void> {
  if (session.user.role !== "ADMIN") {
    // TODO: サーバ側のロジックで画面を操作するようなunauthorized()を使うんじゃなくて、あくまで認証認可チェックの結果だけを返してフロント側で画面制御をさせたい。
    unauthorized();
  }
}

/**
 * リソース所有権を検証（認可のみ・本人チェック）
 *
 * セッションのユーザーが対象リソースの所有者であることを確認する。
 * 認証チェック（verifySession）は呼び出し元で行うこと。
 * 管理者チェックが必要な場合は verifyAdmin を別途使用する。
 *
 * @param session 認証済みセッション
 * @param resourceEmployeeId リソースの所有者の従業員ID
 * @throws unauthorized() - 本人でない場合
 *
 * @example
 * ```typescript
 * export async function updateEmployee(employeeId: string, ...) {
 *   const session = await verifySession(); // 認証
 *   await verifyOwner(session, employeeId); // 認可（本人のみ）
 *   // 本人のみがここに到達
 * }
 * ```
 */
export async function verifyOwner(
  session: AuthSession,
  resourceEmployeeId: string
): Promise<void> {
  if (session.user.employeeId !== resourceEmployeeId) {
    unauthorized();
  }
}
