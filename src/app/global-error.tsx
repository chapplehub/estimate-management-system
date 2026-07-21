"use client";

import { useEffect } from "react";
import { reportError } from "@/app/_lib/report-error";

/**
 * ルート layout 例外の最終防波堤。
 *
 * (features)/error.tsx が捕捉できない層——ルート layout.tsx 自体・(auth) 配下——で発生した
 * 未処理例外を捕捉し、ルート layout を丸ごと置き換えて全画面を描画する（本番のみ発火）。
 *
 * 最終防波堤ゆえに、共通 ErrorFallback / shadcn / フォント等の依存が壊れて共倒れしないよう、
 * 何にも依存せず自前の <html><body> と素朴なマークアップだけで自己完結させる
 * （ADR-20260721-ef0）。globals.css も import せず、CSS が効かなくても文意が壊れない構成にする。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, "global-error");
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            問題が発生しました
          </h1>
          <p style={{ marginBottom: "1rem", lineHeight: 1.6 }}>
            処理中に予期しないエラーが発生しました。お手数ですが、時間をおいて再度お試しください。
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#666", marginBottom: "1rem" }}>
              参照 ID: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            再試行
          </button>
        </main>
      </body>
    </html>
  );
}
