import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "商品管理 - ESM",
};

export default function ProductLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
