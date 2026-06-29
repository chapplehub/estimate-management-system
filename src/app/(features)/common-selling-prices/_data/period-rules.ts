/**
 * 共通売単価 適用期間の不変条件（純粋述語）。#429 第一段階 / プレゼンテーション層先行。
 *
 * 重複禁止・時点状態の派生・状態別の編集/削除権限という「核心仕様」を、
 * 副作用もストア参照も持たない純粋関数として切り出す。テストが仕様を文書化し、
 * #466（BE基盤）のドメイン実装へケースをそのまま移植できるようにする狙い。
 *
 * 参照日は引数で受ける（`mock-store` の `REFERENCE_DATE` をここに import しない）。
 * これにより `mock-store → period-rules` の一方向依存を保ち、テストでは参照日を固定注入できる。
 * 用語の正準は CONTEXT.md「価格」節 / use-cases.md §5。
 */

import type { PeriodState } from "./types";

/** 重複・時点判定に必要な期間境界の最小形。`endDate=null` は無期限（+∞）。 */
export type PeriodBounds = {
  /** 適用開始日 `YYYY-MM-DD`（下端・含む）。 */
  startDate: string;
  /** 適用終了日 `YYYY-MM-DD`（上端・含まない）。null=無期限。 */
  endDate: string | null;
};

/** 行の時点状態に応じて何が許されるか（UI のボタン表示・ミューテータのガード共用）。 */
export type PeriodAuthority = {
  /** 全項目編集可（将来行のみ）。 */
  editable: boolean;
  /** 適用終了＝終了日設定のみ可（現在有効行のみ）。 */
  endDatable: boolean;
  /** 物理削除可（将来行のみ）。 */
  deletable: boolean;
};

/**
 * 参照日に対する期間行の時点状態を判定する。
 * ISO日付（`YYYY-MM-DD`）は辞書順比較がそのまま日付順比較になるため文字列比較で足りる。
 * queries.ts の `classify` と同一ロジック（射影とルールで定義を一致させる）。
 */
export function classifyState(period: PeriodBounds, referenceDate: string): PeriodState {
  if (referenceDate < period.startDate) return "future";
  if (period.endDate != null && referenceDate >= period.endDate) return "lapsed";
  return "current";
}

/**
 * 2つの適用期間が重複するか。
 *
 * 半開区間 `[start, end)` の重複条件 `aStart < bEnd && bStart < aEnd`。
 * `endDate=null` は +∞ として扱い、その辺の比較を常に真にする。
 * 境界が接するだけ（`a.endDate === b.startDate`）のケースは重複ではない
 * ＝ 現行期間を締めた直後に新期間を発効開始日から登録する「改定」フローを通すため。
 */
export function overlaps(a: PeriodBounds, b: PeriodBounds): boolean {
  const aStartBeforeBEnd = b.endDate == null || a.startDate < b.endDate;
  const bStartBeforeAEnd = a.endDate == null || b.startDate < a.endDate;
  return aStartBeforeBEnd && bStartBeforeAEnd;
}

/**
 * 候補期間が既存期間群のいずれかと重複するか。
 * `excludeId` は自己除外（編集時に自分自身との重複を誤検出しないため）。
 */
export function hasOverlap(
  candidate: PeriodBounds,
  existing: ReadonlyArray<PeriodBounds & { periodId: string }>,
  excludeId?: string
): boolean {
  return existing.some((period) => period.periodId !== excludeId && overlaps(candidate, period));
}

/** 時点状態から編集/適用終了/削除の権限を導く（use-cases.md §7 の表に一致）。 */
export function authorityFor(state: PeriodState): PeriodAuthority {
  return {
    editable: state === "future",
    endDatable: state === "current",
    deletable: state === "future",
  };
}
