import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "部署管理 - ESM",
};

export default function DepartmentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
