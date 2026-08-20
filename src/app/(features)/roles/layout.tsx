import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "役割管理 - ESM",
};

export default function RoleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
