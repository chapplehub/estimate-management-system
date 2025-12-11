import { getUserSession } from "@/server/auth";

export const Header = async () => {
  const session = await getUserSession();

  // TODO: どこかのファイルで一括で画面名を管理して、ルーティングに応じて画面名を出せるようにしたい。
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">ESM</span>
          <span className="hidden text-sm text-muted-foreground sm:inline-block">
            見積管理システム
          </span>
        </div>
        <div className="flex items-center gap-4">
          {session?.user && (
            <span className="text-sm text-foreground">{session.user.name}</span>
          )}
        </div>
      </div>
    </header>
  );
};
