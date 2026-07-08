import { type VariationApplicationStateBadgeTone as BadgeTone } from "@/app/_components/shared/variationApplicationStateBadge";
import { type ApprovalStepStatusCode } from "@subdomains/estimate/domain/values/approval/ApprovalStepStatus";

/**
 * 承認ステップ状態（4値・§3.6）→ バッジ色調の写像（見積申請詳細のチェーン各段・#574）。
 *
 * 申請状態とは別概念（主語がステップ）なので写像も別関数として持つが、色調の語彙（tone）と
 * `tone→className` は共通 tone 層（`shared/variationApplicationStateBadge`）を単一ソースとして再利用する。
 * 進行中（AWAITING）を info・完了（APPROVED）を success・差戻（REJECTED）を warning・未着手を neutral とし、
 * 申請状態バッジと同じ配色語彙で揃える。
 *
 * `default` の `never` ガードで全 code 網羅をコンパイル時に強制する（VO に値が増えたらここが型エラー）。
 */
export function approvalStepStatusBadgeToneOf(code: ApprovalStepStatusCode): BadgeTone {
  switch (code) {
    case "NOT_STARTED":
      return "neutral";
    case "AWAITING":
      return "info";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "warning";
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}
