"use client";

import { useSession } from "@/app/_lib/auth-client";

/**
 * ユーザー名表示コンポーネント（Client Component）
 *
 * クライアントサイドでセッション情報を取得し、ユーザー名を表示する。
 * これによりレイアウトを静的に保ち、フルルートキャッシュを有効にできる。
 *
 * @see learning/auth-responsibilities-and-changeability.md
 */
export const UserDisplay = () => {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <span className="text-sm text-muted-foreground animate-pulse">...</span>
    );
  }

  if (!session?.user) {
    return null;
  }

  return <span className="text-sm text-foreground">{session.user.name}</span>;
};
