"use server";

import { getRequiredSession } from "@/app/_lib/getRequiredSession";
import { signOut } from "@server/shared/auth";
import { redirect } from "next/navigation";

/**
 * サインアウトを実行するServer Action
 */
export async function signOutAction() {
  // 認証チェック: ログイン済みユーザーのみ
  await getRequiredSession();

  await signOut();
  redirect("/signin");
}
