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
  return (
    <div className="h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}
