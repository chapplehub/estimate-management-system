"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/app/_components/shared/ErrorFallback";
import { reportError } from "@/app/_lib/report-error";

/**
 * (features) セグメントのエラー境界。
 *
 * 配下ページ・子コンポーネントのレンダリング／データ取得で発生した未処理例外を捕捉する。
 * Header は (features)/layout.tsx 側に残り、本文だけ ErrorFallback に差し替わる（通常運用の 500 系 UX）。
 * error.tsx 自身は境界の外なので layout の例外は捕捉しない（それは global-error が受ける）。
 */
export default function FeaturesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, "features-boundary");
  }, [error]);

  return <ErrorFallback reset={reset} digest={error.digest} />;
}
