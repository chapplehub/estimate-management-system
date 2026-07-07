/**
 * 承認待ちステップ導出の入力事実（各ステップの stepOrder と承認行の有無）。
 * 集約 `EstimateApplication`（自分のステップから算出）と read model（Prisma 直読み）の双方が
 * この形に materialize してから導出関数へ渡す（{@link deriveApplicationStatus} と同じ流儀）。
 */
export type AwaitingStepFacts = {
  /** ステップの順序（見積内で 1 始まりの昇順・§3.6）。 */
  stepOrder: number;
  /** このステップに承認行があるか。 */
  hasApproval: boolean;
};

/**
 * 承認待ちステップ（＝承認行の無い最小 stepOrder）を導出する純粋関数（ADR-20260707-b36）。
 *
 * 承認は stepOrder 昇順に進む（§3.6）ため、承認行の無い最小順序が「今まさに承認待ち」のステップ。
 * 全ステップに承認行がある（＝全承認済）か、ステップが空なら承認待ちは無く null を返す。
 *
 * この関数は **PENDING 前提**で呼ぶ（承認待ちが存在するのは申請が PENDING のときのみ）。
 * PENDING でない申請に承認待ち役割は無い、という判断は呼び出し側が持つ（本関数は事実の走査に徹する・
 * {@link deriveApplicationStatus} と同じ責務分担）。書き込み側 `EstimateApplication.stepStatus` の
 * AWAITING 判定（下位ステップ全承認）と同じ不変条件に依るため、規則変更時は整合を保つ。
 */
export function deriveAwaitingStepOrder(steps: ReadonlyArray<AwaitingStepFacts>): number | null {
  const unapproved = steps.filter((step) => !step.hasApproval);
  if (unapproved.length === 0) {
    return null;
  }
  return unapproved.reduce((min, step) => (step.stepOrder < min ? step.stepOrder : min), Infinity);
}
