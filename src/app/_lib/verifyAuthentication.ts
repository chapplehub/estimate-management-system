import { getCurrentSession, isAdmin, isOwner, type AuthSession } from "@server/shared/auth";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * 認証済みセッションを取得する（null を返さない）
 *
 * 認証の正本（ADR-20260727-gk3）。ページ本体・Server Action の実行境界で呼ぶ。
 * proxy はサインインへ誘導する前捌きにすぎず、Server Action は matcher の
 * next-action 除外（#25）でそもそも proxy を通らない。
 * 同一リクエスト内で複数回呼んでも cache() により1回だけ実行される。
 * セッションがない場合はサインインページにリダイレクト。
 *
 * @returns AuthSession（null なし）
 */
export const verifySession = cache(async (): Promise<AuthSession> => {
  const session = await getCurrentSession();
  if (!session) {
    // ここが未認証を弾く正本。Server Action は proxy を通らないため、失効セッションの
    // 到達は異常系ではなく通常の一次チェックにあたる
    redirect(`/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`);
  }
  return session;
});

/** 認可失敗時の既定の遷移先 */
const DEFAULT_FORBIDDEN_REDIRECT = `/signin?reason=${REDIRECT_REASON.FORBIDDEN}`;

/**
 * 管理者権限を持つセッションを取得する
 *
 * 認証済みかつ管理者であることを確認する。
 * 管理者でない場合は redirectTo へリダイレクト（省略時は FORBIDDEN でサインインページ）。
 *
 * @param redirectTo - 管理者でない場合の遷移先（省略時はサインインページ）
 * @returns AuthSession（管理者のセッション）
 */
export async function verifyAdmin(
  redirectTo: string = DEFAULT_FORBIDDEN_REDIRECT
): Promise<AuthSession> {
  const session = await verifySession();
  if (!isAdmin(session)) {
    redirect(redirectTo);
  }
  return session;
}

/**
 * 本人または管理者であることを確認する
 *
 * 認証済みかつ、対象リソースの所有者または管理者であることを確認する。
 * どちらでもない場合は redirectTo へリダイレクト（省略時は FORBIDDEN でサインインページ）。
 *
 * @param resourceOwnerId - リソース所有者の従業員ID（isOwner が session.user.employeeId と突き合わせる）
 * @param redirectTo - 本人でも管理者でもない場合の遷移先（省略時はサインインページ）
 * @returns AuthSession（本人または管理者のセッション）
 */
export async function verifyOwnerOrAdmin(
  resourceOwnerId: string,
  redirectTo: string = DEFAULT_FORBIDDEN_REDIRECT
): Promise<AuthSession> {
  const session = await verifySession();
  if (!isOwner(session, resourceOwnerId) && !isAdmin(session)) {
    redirect(redirectTo);
  }
  return session;
}
