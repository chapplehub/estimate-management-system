"use server";

import { getCurrentSession, signOut } from "@server/shared/auth";
import { REDIRECT_REASON } from "@shared/constants/redirect-reasons";
import { redirect } from "next/navigation";

/**
 * サインアウトを実行するServer Action
 */
export async function signOutAction() {
  // 認証チェック: ログイン済みユーザーのみ
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/signin?reason=${REDIRECT_REASON.SESSION_EXPIRED}`);
  }

  await signOut();
  redirect("/signin");
}
