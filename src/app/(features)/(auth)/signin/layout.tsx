import { notoSansJp } from "@/app/fonts";
import "@app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "estimate-management-system",
  description: "this is a estimate-management-system",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJp.variable} antialiased`}>{children}</body>
    </html>
  );
}
