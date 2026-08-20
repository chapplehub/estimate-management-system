/**
 * 例外ログの単一接続点（シーム）。
 *
 * App Router の各エラー境界（`error.tsx` / `global-error.tsx`）や read 系 Server Action の
 * 共通ラッパー（`callReadAction`）は送り先を直接知らず、
 * この関数を `reportError(error, context)` として呼ぶだけにする。
 * 現状の中身は `console.error`＋`digest`（サーバーログとの相関 ID）に留め、
 * 将来 Sentry 等の実監視へ差し替える際はこの 1 関数だけを変更すれば済むようにする。
 * 実監視の接続は #587 のスコープ外（ADR-20260721-ef0 参照）。
 *
 * @param error 捕捉した例外。`Error & { digest?: string }` を想定するが unknown を受ける
 * @param context 発生箇所の識別子（例: 境界名 "features-boundary" / "global-error"、
 *   read 系ラッパーからは呼び出した Server Action の関数名リテラル）
 */
export function reportError(error: unknown, context: string): void {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? (error as { digest?: string }).digest
      : undefined;

  console.error(`[report-error] ${context}`, { digest, error });
}
