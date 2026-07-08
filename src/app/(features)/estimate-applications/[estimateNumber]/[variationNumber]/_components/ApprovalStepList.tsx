import { Badge } from "@/app/_components/shadcnui/badge";
import { badgeToneClassName } from "@/app/_components/shared/variationApplicationStateBadge";
import { type ApprovalStepView } from "@subdomains/estimate/application/queries/dto/EstimateApplicationDetailDTO";
import { formatDateTime } from "../../../_shared/labels";
import { approvalStepStatusBadgeToneOf } from "./approvalStepStatusBadge";

/**
 * 承認チェーン（テーブル6列・§3.6）。1 行＝1 承認ステップ（stepOrder 昇順）。
 *
 * DTO が均一テーブル前提で flat 化（承認者/差戻者を `actorName` に畳み込み）しているため、
 * ステッパーではなくテーブルで受ける。進行感は状態バッジの色（AWAITING=info / APPROVED=success /
 * REJECTED=warning）で補う。未決フィールド（actorName / decidedAt / rejectionComment の null）は「—」。
 */
export function ApprovalStepList({ steps }: { steps: ApprovalStepView[] }) {
  return (
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm text-left whitespace-nowrap">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-3 py-2 font-bold text-gray-700 text-right">順序</th>
            <th className="px-3 py-2 font-bold text-gray-700">役割</th>
            <th className="px-3 py-2 font-bold text-gray-700">状態</th>
            <th className="px-3 py-2 font-bold text-gray-700">承認者・差戻者</th>
            <th className="px-3 py-2 font-bold text-gray-700">発生日時</th>
            <th className="px-3 py-2 font-bold text-gray-700">差戻コメント</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.order} className="border-b">
              <td className="px-3 py-2 text-right">{step.order}</td>
              <td className="px-3 py-2">{step.roleName}</td>
              <td className="px-3 py-2">
                <Badge
                  variant="outline"
                  className={badgeToneClassName(approvalStepStatusBadgeToneOf(step.status.code))}
                >
                  {step.status.label}
                </Badge>
              </td>
              <td className="px-3 py-2">{step.actorName ?? "—"}</td>
              <td className="px-3 py-2">
                {step.decidedAt !== null ? formatDateTime(step.decidedAt) : "—"}
              </td>
              <td className="px-3 py-2 whitespace-pre-wrap">{step.rejectionComment ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
