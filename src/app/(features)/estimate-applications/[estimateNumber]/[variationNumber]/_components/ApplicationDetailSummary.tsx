import Link from "next/link";
import { Badge } from "@/app/_components/shadcnui/badge";
import {
  badgeToneClassName,
  badgeToneOf,
} from "@/app/_components/shared/variationApplicationStateBadge";
import { type ApplicationDetailSummaryView } from "@subdomains/estimate/application/queries/dto/EstimateApplicationDetailDTO";
import { SUBMISSION_TYPE_LABELS, formatYen } from "../../../_shared/labels";

/**
 * バリエーション要約ヘッダ（§3.1-1）。見積番号（見積詳細へのリンク）・バリエーション番号・
 * 得意先/納品先・提出区分・税込合計・バリエーション申請状態バッジを示す。明細の全内容は見積詳細に
 * 委ね、本画面には複製しない。
 *
 * 申請状態バッジは共通 tone 層（`badgeToneOf`／`badgeToneClassName`）を一覧と共有し、label は VO 単一
 * ソース（ADR-0069）。見積詳細リンクは既存の業務キー URL `/estimates/[estimateNumber]` へ張る。
 */
export function ApplicationDetailSummary({ summary }: { summary: ApplicationDetailSummaryView }) {
  return (
    <section className="bg-white shadow-md rounded p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/estimates/${summary.estimateNumber}`}
            className="text-2xl font-bold text-blue-600 hover:text-blue-800 hover:underline"
          >
            {summary.estimateNumber}
          </Link>
          <span className="text-lg text-gray-500">バリ {summary.variationNumber}</span>
        </div>
        <Badge
          variant="outline"
          className={badgeToneClassName(badgeToneOf(summary.applicationState.code))}
        >
          {summary.applicationState.label}
        </Badge>
      </div>

      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
        <dt className="font-bold text-gray-600">得意先</dt>
        <dd className="text-gray-800">{summary.customerName}</dd>
        <dt className="font-bold text-gray-600">納品先</dt>
        <dd className="text-gray-800">{summary.deliveryLocationName}</dd>
        <dt className="font-bold text-gray-600">提出区分</dt>
        <dd className="text-gray-800">
          {SUBMISSION_TYPE_LABELS[summary.submissionType] ?? summary.submissionType}
        </dd>
        <dt className="font-bold text-gray-600">税込合計</dt>
        <dd className="text-gray-800">{formatYen(summary.finalTotal)}</dd>
      </dl>
    </section>
  );
}
