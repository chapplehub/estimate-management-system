import { Header } from "@/app/_components/shared/header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ESM - 見積管理システム",
  description: "見積管理システム",
};

// 認証配下（(features) 配下の全ページ）は動的レンダリングを既定とする（ADR-20260727-2fb）。
//
// 消さないこと。この 1 行が無いと、DB を読むページがビルド時に静的化され、ビルド時点の
// マスタが HTML に焼き込まれたまま配信される（#644）。Next は「動的 API を使わなければ静的化
// してよい」と判定するが、Prisma 呼び出しは Next にとって単なる非同期関数なので検出されない。
// proxy.ts は毎リクエスト走るがレンダリングのキャッシュ判定には関与しないため、認証は効くのに
// 画面内容だけ古い、という状態になる。
//
// 本システムは全ページが認証必須かつ可変データを表示するため、静的化の受益者（匿名ユーザーへの
// 同一 HTML の大量配信）に該当しない。認証不要な `/` と `/signin` は (features) の外にあり、
// 静的なまま残る。
export const dynamic = "force-dynamic";

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
