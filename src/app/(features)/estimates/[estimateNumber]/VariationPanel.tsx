"use client";

import { useState } from "react";
import { Badge } from "@/app/_components/shadcnui/badge";
import type { VariationDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { SUBMISSION_TYPE_LABELS, formatYen } from "../_shared/labels";
import { LineTable } from "./components/LineTable";

type Props = {
  variations: VariationDTO[];
};

/**
 * バリエーションパネル（④〜⑨・クライアントアイランド・計画 Q6）。
 *
 * タブ切替（activeVariationIndex）と明細行のアクティブ化（activeRowId）を管理する。
 * 書き込み経路は持たない（行アクティブ化はハイライトのみ。直下挿入・編集は S4 以降）。
 */
export function VariationPanel({ variations }: Props) {
  // 既定タブ＝最小番号の ACTIVE バリ（全 INACTIVE なら最小番号）。variations は番号昇順。
  const firstActive = variations.findIndex((v) => v.status === "ACTIVE");
  const [activeIndex, setActiveIndex] = useState(firstActive >= 0 ? firstActive : 0);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const allInactive = variations.every((v) => v.status !== "ACTIVE");
  const active = variations[activeIndex];

  function selectVariation(index: number): void {
    setActiveIndex(index);
    setActiveRowId(null); // タブ切替で行アクティブをリセット（Q6）
  }

  return (
    <div>
      {/* 全無効警告（presentation 導出・Q7。DTO に専用フラグは持たせない） */}
      {allInactive && (
        <div
          role="alert"
          className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4"
        >
          すべてのバリエーションが無効です。
        </div>
      )}

      {/* ④ タブ（無効はグレーアウト＋取消線） */}
      <div role="tablist" aria-label="バリエーション" className="flex gap-1 border-b mb-4">
        {variations.map((v, i) => {
          const isInactive = v.status !== "ACTIVE";
          const isSelected = i === activeIndex;
          return (
            <button
              key={v.variationId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => selectVariation(i)}
              className={[
                "px-4 py-2 -mb-px border-b-2 transition-colors",
                isSelected
                  ? "border-blue-500 font-bold text-blue-700"
                  : "border-transparent text-gray-600 hover:text-gray-900",
                isInactive ? "text-gray-400 line-through" : "",
              ].join(" ")}
            >
              バリエーション{v.variationNumber}
            </button>
          );
        })}
      </div>

      {active && (
        <div>
          {/* ⑤ 操作行（提出区分バッジ・状態インジケータ） */}
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="outline">
              {SUBMISSION_TYPE_LABELS[active.submissionType] ?? active.submissionType}
            </Badge>
            <span className="text-sm text-gray-600">
              {active.status === "ACTIVE" ? "● 有効" : "○ 無効"}
            </span>
          </div>

          {/* ⑥ 明細テーブル */}
          <LineTable lines={active.lines} activeRowId={activeRowId} onSelectRow={setActiveRowId} />

          {/* ⑦ 全体値引 */}
          {active.overallDiscount > 0 && (
            <div className="mt-4 text-right text-sm text-gray-700">
              全体値引: -{formatYen(active.overallDiscount)}
            </div>
          )}

          {/* ⑧ メモ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <MemoBlock label="顧客メモ" value={active.customerMemo} />
            <MemoBlock label="社内メモ" value={active.internalMemo} />
          </div>

          {/* ⑨ 金額サマリー（選択中バリの永続集計・ADR-0033。バリは代替・合算しない） */}
          <div className="mt-6 flex justify-end">
            <dl className="w-full md:w-80 space-y-1 text-sm">
              <SummaryRow label="小計" value={active.subtotal} />
              <SummaryRow label="税抜合計" value={active.finalSubtotal} />
              <SummaryRow label="消費税" value={active.taxAmount} />
              <SummaryRow label="合計" value={active.finalTotal} emphasize />
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 mb-1">{label}</h3>
      <p className="text-gray-900 whitespace-pre-wrap min-h-6">{value || "—"}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  return (
    <div
      className={[
        "flex justify-between py-1",
        emphasize ? "border-t pt-2 text-lg font-bold text-gray-900" : "text-gray-700",
      ].join(" ")}
    >
      <dt>{label}</dt>
      <dd>{formatYen(value)}</dd>
    </div>
  );
}
