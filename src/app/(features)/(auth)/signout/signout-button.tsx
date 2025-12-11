"use client";

import { Button } from "@/app/_components/shadcnui/button";
import { signOutAction } from "./actions";

export function SignoutButton() {
  return (
    <Button onClick={() => signOutAction()} variant="destructive">
      サインアウト
    </Button>
  );
}
