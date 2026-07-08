import { ApprovalStepStatus } from "./ApprovalStepStatus";

/**
 * ステップの §3.6 導出に必要な事実（当該ステップの決定行の有無・申請の PENDING 性・
 * 下位 stepOrder の全承認）。集約 `EstimateApplication`（自分の行から算出）と read model
 * （Prisma 直読み）の双方がこの形に materialize してから導出関数へ渡す
 * （{@link deriveApplicationStatus} と同じ流儀）。
 */
export type ApprovalStepStatusFacts = {
  /** 当該ステップに差戻行があるか。 */
  hasRejection: boolean;
  /** 当該ステップに承認行があるか。 */
  hasApproval: boolean;
  /** 申請が導出上 PENDING か（承認待ちが存在する前提）。 */
  applicationIsPending: boolean;
  /** 当該ステップより下位 stepOrder が全て承認済か。 */
  lowerStepsAllApproved: boolean;
};

/**
 * ステップの導出状態を §3.6 の規則で決める純粋関数（上から評価し最初に一致）:
 * - 差戻行あり → REJECTED（最優先）
 * - 承認行あり → APPROVED
 * - 決定なし＋申請 PENDING＋下位が全承認 → AWAITING
 * - 決定なし＋申請が PENDING でない、または下位に未承認あり → NOT_STARTED
 *
 * この優先順位は書き込み（集約 `stepStatus`）と読み取り（read model）で唯一の真実として
 * 共有する（ドリフト封じ）。判定入力は materialize 済みの事実に限り、行の走査（下位ステップ全承認
 * の判定など）は呼び出し側が担う（{@link deriveApplicationStatus} と同じ責務分担）。
 */
export function deriveApprovalStepStatus(facts: ApprovalStepStatusFacts): ApprovalStepStatus {
  if (facts.hasRejection) {
    return ApprovalStepStatus.REJECTED;
  }
  if (facts.hasApproval) {
    return ApprovalStepStatus.APPROVED;
  }
  if (!facts.applicationIsPending) {
    return ApprovalStepStatus.NOT_STARTED;
  }
  return facts.lowerStepsAllApproved ? ApprovalStepStatus.AWAITING : ApprovalStepStatus.NOT_STARTED;
}
