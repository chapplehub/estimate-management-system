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
import { verifySession } from "./authentication";

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
 * リソース所有権を検証（本人または管理者）
 *
 * 対象リソースの所有者または管理者であることを確認する。
 * 条件を満たさない場合は 401 を返す。
 *
 * @param resourceEmployeeId リソースの所有者の従業員ID
 * @returns 検証済みセッション
 * @throws unauthorized() - 本人でも管理者でもない場合
 *
 * @example
 * ```typescript
 * export async function updateEmployee(employeeId: string, ...) {
 *   await verifyOwnerOrAdmin(employeeId);
 *   // 本人または管理者のみがここに到達
 * }
 * ```
 */
export async function verifyOwnerOrAdmin(
  resourceEmployeeId: string
): Promise<AuthSession> {
  const session = await verifySession();

  // 管理者は全てのリソースにアクセス可能
  if (session.user.role === "ADMIN") {
    return session;
  }

  // 本人のリソースのみアクセス可能
  if (session.user.employeeId !== resourceEmployeeId) {
    unauthorized();
  }

  return session;
}
