"use server";

import { signOut, verifySession } from "@server/shared/auth";
import { redirect } from "next/navigation";

/**
 * サインアウトを実行するServer Action
 */
export async function signOutAction() {
  // 認証チェック: ログイン済みユーザーのみ
  await verifySession();

  await signOut();
  redirect("/signin");
}
