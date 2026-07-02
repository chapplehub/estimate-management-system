/**
 * 適用期間（`"YYYY-MM-DD"` の開始日・終了日）を「開始日 〜 終了日」形式へ整形する純関数
 * （#501・client/server 両用。#513 の共通売単価一覧も同じものを使う）。
 *
 * 終了日は半開区間の排他上端の生値をそのまま表示する（包含端 end-1日 への変換はしない）。理由:
 * 一覧→保守画面（PeriodDetailPanel）で同じ日付が見えることを優先し、変換ロジックを一覧に持ち込まない。
 * `end: null` は無期限（読みモデル DTO・編集画面と同一意味論）。
 */
export function formatPeriod(start: string, end: string | null): string {
  return `${start} 〜 ${end ?? "無期限"}`;
}
