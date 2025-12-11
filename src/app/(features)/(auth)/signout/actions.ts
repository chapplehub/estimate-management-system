"use server";

import { signOut } from "@server/shared/auth";
import { redirect } from "next/navigation";

/**
 * サインアウトを実行するServer Action
 */
export async function signOutAction() {
  await signOut();
  redirect("/signin");
}
