// "use client" は付けない。本コンポーネントは client の error.tsx からのみ import され、
// その境界越しに transitively に client 化される。ここで client エントリにすると
// 関数 prop（reset）が Server Action 扱いを要求され警告になるため、あえて共有部品に留める。

import Link from "next/link";
import { Button } from "@/app/_components/shadcnui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/_components/shadcnui/card";

type ErrorFallbackProps = {
  /** 同一境界を再マウントして復旧を試みる。Next の error.tsx が渡す reset をそのまま繋ぐ */
  reset: () => void;
  /**
   * Next がサーバーログとの相関用に付与する digest。
   * 本番では error.message がサニタイズされ digest のみ残るため、参照 ID として控えめに表示する。
   */
  digest?: string;
};

/**
 * features 配下のエラー境界が表示する共通フォールバック UI。
 *
 * 例外オブジェクトそのものは受け取らない設計にし、message / stack を UI に出さない方針
 * （ADR-20260721-ef0）を型で強制する。表示するのは固定の汎用メッセージと、あれば参照 ID のみ。
 */
export function ErrorFallback({ reset, digest }: ErrorFallbackProps) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>問題が発生しました</CardTitle>
          <CardDescription>
            処理中に予期しないエラーが発生しました。お手数ですが、時間をおいて再度お試しください。
          </CardDescription>
        </CardHeader>
        {digest && (
          <CardContent>
            <p className="text-muted-foreground text-xs">参照 ID: {digest}</p>
          </CardContent>
        )}
        <CardFooter className="gap-2">
          <Button onClick={reset}>再試行</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">トップへ戻る</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
