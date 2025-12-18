import { notoSansJp } from "@/app/fonts";
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@app/_components/shadcnui/sonner";
import { RedirectReasonToast } from "@app/_components/redirect-reason-toast";

export const metadata: Metadata = {
  title: "estimate-management-system",
  description: "this is a estimate-management-system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJp.variable} antialiased`}>
        {children}
        <Toaster />
        <RedirectReasonToast />
      </body>
    </html>
  );
}
