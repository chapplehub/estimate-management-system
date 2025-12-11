import { Header } from "@/app/_components/shared/header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ESM - 見積管理システム",
  description: "見積管理システム",
};

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TODO: どこかのファイルで一括で画面名を管理して、ルーティングに応じて画面名を出せるようにしたい。
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>{children}</main>
    </div>
  );
}
