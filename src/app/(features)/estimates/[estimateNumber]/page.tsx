import { verifySession } from "@/app/_lib/verifyAuthentication";
import { Badge } from "@/app/_components/shadcnui/badge";
import { getEstimateDetailQueryFactory } from "@subdomains/estimate/application/factories/estimateQueryFactory";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ESTIMATE_TYPE_LABELS, formatDate } from "../_shared/labels";
import { VariationPanel } from "./VariationPanel";

/**
 * 見積詳細画面 S2（閲覧・read-only）。
 *
 * RSC（本ファイル・薄い）が ②タイトル行・③基本情報/修理情報を静的描画し、④〜⑨ を
 * クライアントアイランド VariationPanel へ委譲する（計画 Q6）。書き込み経路は持たない。
 */
export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ estimateNumber: string }>;
}) {
  const { estimateNumber } = await params;
  await verifySession();

  const estimate = await getEstimateDetailQueryFactory().execute({ estimateNumber });
  if (!estimate) {
    notFound();
  }

  return (
    <div className="container mx-auto p-8">
      {/* ② タイトル行（見積番号・区分バッジ・承認 placeholder・編集 disabled） */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{estimate.estimateNumber}</h1>
          <Badge variant="outline">
            {ESTIMATE_TYPE_LABELS[estimate.estimateType] ?? estimate.estimateType}
          </Badge>
          {/* 承認バッジは申請スライス（D9）まで placeholder */}
          <Badge variant="secondary" aria-label="承認状態">
            未申請
          </Badge>
        </div>
        {/* 編集は S3 で実装。閲覧スライスでは無効表示にとどめる（書き込み経路ゼロ） */}
        <button
          type="button"
          disabled
          title="編集は今後のスライスで実装予定"
          className="bg-gray-300 text-white font-bold py-2 px-4 rounded cursor-not-allowed"
        >
          編集
        </button>
      </div>

      {/* ③ 基本情報（ADR-0013: 名前・コードを表示） */}
      <section className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-500">基本情報</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="得意先">
            {estimate.customerName}（{estimate.customerCode}）
          </Field>
          <Field label="納品先">
            {estimate.deliveryLocationName}（{estimate.deliveryLocationCode}）
          </Field>
          <Field label="部署">{estimate.departmentName}</Field>
          <Field label="作成者">
            {estimate.creatorName}（{estimate.creatorCode}）
          </Field>
          <Field label="見積日">{formatDate(estimate.estimateDate)}</Field>
          <Field label="締切日">{formatDate(estimate.deadline)}</Field>
          <Field label="消費税率">{Math.round(estimate.taxRate * 100)}%</Field>
        </dl>
      </section>

      {/* ③ 修理情報（REPAIR のみ表示） */}
      {estimate.repairDetail && (
        <section className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-500">修理情報</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="修理対象機器">
              {estimate.repairDetail.targetProductName}（{estimate.repairDetail.targetProductCode}）
            </Field>
            <Field label="修理予定日">
              {formatDate(estimate.repairDetail.scheduledRepairDate)}
            </Field>
            <Field label="故障内容" full>
              {estimate.repairDetail.faultDescription}
            </Field>
          </dl>
        </section>
      )}

      {/* ③ 事後修理情報（AFTER_REPAIR のみ表示） */}
      {estimate.afterRepairDetail && (
        <section className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-500">事後修理情報</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="修理対象機器">
              {estimate.afterRepairDetail.targetProductName}（
              {estimate.afterRepairDetail.targetProductCode}）
            </Field>
            <Field label="修理実施日">
              {formatDate(estimate.afterRepairDetail.actualRepairDate)}
            </Field>
            <Field label="緊急対応理由" full>
              {estimate.afterRepairDetail.emergencyReason}
            </Field>
            <Field label="故障内容" full>
              {estimate.afterRepairDetail.faultDescription}
            </Field>
          </dl>
        </section>
      )}

      {/* ④〜⑨ バリエーション（タブ・明細・値引・メモ・金額サマリー） */}
      <VariationPanel variations={estimate.variations} />
    </div>
  );
}

/** ③ 基本情報・修理情報の項目（dt/dd）。`full` で 2 カラム幅。 */
function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : undefined}>
      <dt className="text-sm font-bold text-gray-700">{label}</dt>
      <dd className="mt-1 text-gray-900 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
