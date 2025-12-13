import { SignoutButton } from "@/app/(features)/(auth)/signout/signout-button";
import { UserDisplay } from "./user-display";

export const Header = () => {
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
          <UserDisplay />
        </div>
        <SignoutButton />
      </div>
    </header>
  );
};
