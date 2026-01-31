import { getCurrentSession, isAdmin, isOwner, type AuthSession } from "@server/shared/auth";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { redirect } from "next/navigation";
import { cache } from "react";

/**
 * 認証済みセッションを取得する（null を返さない）
 *
 * proxy を通過後のページ・Server Action から呼び出す。
 * 同一リクエスト内で複数回呼んでも cache() により1回だけ実行される。
 * 万が一セッションがない場合はサインインページにリダイレクト。
 *
 * @returns AuthSession（null なし）
 */
export const verifySession = cache(async (): Promise<AuthSession> => {
  const session = await getCurrentSession();
  if (!session) {
    // proxy を通過しているはずなので、ここに来るのは異常系
    redirect(`/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`);
  }
  return session;
});

/**
 * 管理者権限を持つセッションを取得する
 *
 * 認証済みかつ管理者であることを確認する。
 * 管理者でない場合は FORBIDDEN でリダイレクト。
 *
 * @returns AuthSession（管理者のセッション）
 */
export async function verifyAdmin(): Promise<AuthSession> {
  const session = await verifySession();
  if (!isAdmin(session)) {
    redirect(`/signin?reason=${REDIRECT_REASON.FORBIDDEN}`);
  }
  return session;
}

/**
 * 本人または管理者であることを確認する
 *
 * 認証済みかつ、対象リソースの所有者または管理者であることを確認する。
 * どちらでもない場合は FORBIDDEN でリダイレクト。
 *
 * @param resourceOwnerId - リソース所有者のユーザーID
 * @returns AuthSession（本人または管理者のセッション）
 */
export async function verifyOwnerOrAdmin(resourceOwnerId: string): Promise<AuthSession> {
  const session = await verifySession();
  if (!isOwner(session, resourceOwnerId) && !isAdmin(session)) {
    redirect(`/signin?reason=${REDIRECT_REASON.FORBIDDEN}`);
  }
  return session;
}
