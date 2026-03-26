"use client";

import { useIsClient } from "@/app/_hooks/useIsClient";
import { useSession } from "@/app/_lib/auth-client";
import { Loader2Icon } from "lucide-react";

/**
 * ユーザー名表示コンポーネント（Client Component）
 *
 * クライアントサイドでセッション情報を取得し、ユーザー名を表示する。
 * これによりレイアウトを静的に保ち、フルルートキャッシュを有効にできる。
 *
 * @see learning/auth-responsibilities-and-changeability.md
 */
export const UserDisplay = () => {
  const isClient = useIsClient();
  const { data: session, isPending } = useSession();

  if (!isClient || isPending) {
    return <Loader2Icon className="size-4 animate-spin" />;
  }

  if (!session?.user) {
    return null;
  }

  return <span className="text-sm text-foreground">{session.user.name}</span>;
};
