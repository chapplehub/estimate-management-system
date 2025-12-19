import {
  getCurrentSession,
  type AuthSession,
} from "@server/shared/auth";
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
export const getRequiredSession = cache(async (): Promise<AuthSession> => {
  const session = await getCurrentSession();
  if (!session) {
    // proxy を通過しているはずなので、ここに来るのは異常系
    redirect(`/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`);
  }
  return session;
});
