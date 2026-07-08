import { Badge } from "@/app/_components/shadcnui/badge";
import { badgeToneClassName } from "@/app/_components/shared/variationApplicationStateBadge";
import { type ApplicationView } from "@subdomains/estimate/application/queries/dto/EstimateApplicationDetailDTO";
import { formatDateTime } from "../../../_shared/labels";
import { applicationStatusBadgeToneOf } from "./applicationStatusBadge";
import { ApprovalStepList } from "./ApprovalStepList";

/**
 * 申請 1 件のカード（最新・過去で共用・§3.1-2/3）。申請メタ（申請者・申請日時・attempt・最終承認
 * 役職・申請状態バッジ）と承認チェーン（{@link ApprovalStepList}）を束ねる。取下済みの申請は取下記録
 * （取下者・取下日時）を添える。
 *
 * BE が最新（`latest`）と過去（`past[]`）を同型 `ApplicationView` にした意図に従い、両者を本カードで
 * 共用する（プレゼン層でミラー分岐を作らない・ADR-0069）。
 */
export function ApplicationCard({ application }: { application: ApplicationView }) {
  return (
    <section className="bg-white shadow-md rounded p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-gray-700">申請 #{application.attempt}</h3>
          <Badge
            variant="outline"
            className={badgeToneClassName(applicationStatusBadgeToneOf(application.status.code))}
          >
            {application.status.label}
          </Badge>
        </div>
      </div>

      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="font-bold text-gray-600">申請者</dt>
        <dd className="text-gray-800">{application.applicantName}</dd>
        <dt className="font-bold text-gray-600">申請日時</dt>
        <dd className="text-gray-800">{formatDateTime(application.appliedAt)}</dd>
        <dt className="font-bold text-gray-600">最終承認役職</dt>
        <dd className="text-gray-800">{application.finalApprovalPositionName}</dd>
      </dl>

      {application.withdrawal !== null && (
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm bg-gray-50 rounded p-3">
          <dt className="font-bold text-gray-600">取下者</dt>
          <dd className="text-gray-800">{application.withdrawal.withdrawnByName}</dd>
          <dt className="font-bold text-gray-600">取下日時</dt>
          <dd className="text-gray-800">{formatDateTime(application.withdrawal.withdrawnAt)}</dd>
        </dl>
      )}

      <ApprovalStepList steps={application.steps} />
    </section>
  );
}
