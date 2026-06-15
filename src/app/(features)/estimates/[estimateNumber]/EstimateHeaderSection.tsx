"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/app/_components/shadcnui/badge";
import { ESTIMATE_TYPE_LABELS, TAX_ROUNDING_TYPE_LABELS, formatDate } from "../_shared/labels";
import { EstimateHeaderForm, type EstimateHeaderData } from "./EstimateHeaderForm";

type DepartmentOption = { id: string; name: string };

type Props = {
  estimate: EstimateHeaderData;
  departments: DepartmentOption[];
};

/**
 * 見積詳細 ②タイトル行・③基本情報/修理情報のクライアントアイランド（S3）。
 *
 * `isEditing` で閲覧 ⇄ 編集をその場トグルする（Q4）。④〜⑨（VariationPanel）は RSC の
 * まま page 側に残し、本島はヘッダー領域のみを担う。保存成功時は Server Action が
 * redirect するため、再描画で閲覧モードへ戻る（isEditing は新規マウントで false）。
 */
export function EstimateHeaderSection({ estimate, departments }: Props) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <>
      {/* ② タイトル行 */}
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
          {estimate.hasRevision && <Badge variant="outline">改訂あり</Badge>}
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            編集
          </button>
        )}
      </div>

      {isEditing ? (
        <EstimateHeaderForm
          estimate={estimate}
          departments={departments}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <ReadOnlyHeader estimate={estimate} />
      )}
    </>
  );
}

/** 閲覧モードの ③ 基本情報・修理情報（read-only）。 */
function ReadOnlyHeader({ estimate }: { estimate: EstimateHeaderData }) {
  return (
    <>
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
          <Field label="税端数区分">
            {TAX_ROUNDING_TYPE_LABELS[estimate.taxRoundingType] ?? estimate.taxRoundingType}
          </Field>
        </dl>
      </section>

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
    </>
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
