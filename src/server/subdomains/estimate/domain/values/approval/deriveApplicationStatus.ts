import { ApplicationStatus } from "./ApplicationStatus";

/**
 * 申請の §3.6 導出に必要な事実（終端イベント行の存在と全ステップ承認の有無）。
 * 集約 `EstimateApplication`（自分の行から算出）と read model（Prisma 直読み）の双方が
 * この形に materialize してから導出関数へ渡す。
 */
export type ApplicationStatusFacts = {
  /** 取下イベント行があるか。 */
  hasWithdrawal: boolean;
  /** いずれかのステップに差戻行があるか。 */
  hasAnyRejection: boolean;
  /** 全ステップに承認行があるか。 */
  allStepsApproved: boolean;
};

/**
 * 申請の導出状態を §3.6 の規則で決める純粋関数（上から評価し最初に一致）:
 * - 取下行あり → WITHDRAWN（最優先）
 * - いずれかのステップに差戻行 → REJECTED
 * - 全ステップに承認行 → APPROVED
 * - 上記いずれも無し → PENDING
 *
 * この優先順位は書き込み（集約 getter）と読み取り（read model）で唯一の真実として共有する
 * （ドリフト封じ・#493）。判定入力は materialize 済みの事実に限り、行の走査自体は呼び出し側が
 * 担う（集約は自分のステップ／取下から、read model は Prisma の集計から）。
 */
export function deriveApplicationStatus(facts: ApplicationStatusFacts): ApplicationStatus {
  if (facts.hasWithdrawal) {
    return ApplicationStatus.WITHDRAWN;
  }
  if (facts.hasAnyRejection) {
    return ApplicationStatus.REJECTED;
  }
  if (facts.allStepsApproved) {
    return ApplicationStatus.APPROVED;
  }
  return ApplicationStatus.PENDING;
}
