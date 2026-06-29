"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/app/_components/shadcnui/badge";
import { authorityFor } from "../_data/period-rules";
import type { CommonSellingPriceDetail, PeriodState } from "../_data/types";
import { PeriodDeleteConfirm } from "./PeriodDeleteConfirm";
import { PeriodForm } from "./PeriodForm";

/** 派生状態のラベルと Badge variant（現在有効/将来/失効）。 */
const STATE_BADGE: Record<
  PeriodState,
  { label: string; variant: "default" | "outline" | "secondary" }
> = {
  current: { label: "現在有効", variant: "default" },
  future: { label: "将来", variant: "outline" },
  lapsed: { label: "失効", variant: "secondary" },
};

/** 円表示。 */
function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

/**
 * パネルの開閉モード（決定2: URLに載せずクライアント状態で保持）。
 * 対象は periodId で保持し、revalidate後の最新 detail から都度引き直す（stale回避）。
 */
type PanelMode =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; periodId: string }
  | { kind: "endDate"; periodId: string }
  | { kind: "delete"; periodId: string };

type Props = {
  detail: CommonSellingPriceDetail;
};

/**
 * UC-2 期間明細の表示＋UC-3/4/5 の操作配線（client wrapper）。
 *
 * 時点状態（現在有効/将来/失効）に応じて各行の編集/適用終了/削除ボタンを出し分け
 * （use-cases.md §7・authorityFor）、登録/編集/適用終了は単一 PeriodForm をモードで
 * 切り替えて下部パネルに表示する。削除は行内2段階確認（決定5）。
 */
export function PeriodDetailPanel({ detail }: Props) {
  const [mode, setMode] = useState<PanelMode>({ kind: "closed" });
  const close = useCallback(() => setMode({ kind: "closed" }), []);

  // 編集系パネルの対象行を最新 detail から引く（削除済みなら閉じる）。
  const formMode =
    mode.kind === "new" || mode.kind === "edit" || mode.kind === "endDate" ? mode : null;
  const formPeriod =
    formMode != null && formMode.kind !== "new"
      ? detail.periods.find((p) => p.periodId === formMode.periodId)
      : undefined;

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-500">適用期間</h2>
        <button
          type="button"
          onClick={() => setMode({ kind: "new" })}
          className="bg-blue-500 hover:bg-blue-700 text-white text-sm font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          新規追加
        </button>
      </div>

      {detail.periods.length > 0 ? (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-sm font-bold text-gray-700">適用開始日</th>
              <th className="py-2 text-sm font-bold text-gray-700">適用終了日</th>
              <th className="py-2 text-sm font-bold text-gray-700 text-right">共通売単価</th>
              <th className="py-2 text-sm font-bold text-gray-700">状態</th>
              <th className="py-2 text-sm font-bold text-gray-700 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {detail.periods.map((period) => {
              const badge = STATE_BADGE[period.state];
              const auth = authorityFor(period.state);
              const isDeleting = mode.kind === "delete" && mode.periodId === period.periodId;
              return (
                <tr key={period.periodId} className="border-b">
                  <td className="py-2 tabular-nums">{period.startDate}</td>
                  <td className="py-2 tabular-nums">
                    {period.endDate ?? <span className="text-gray-500">無期限</span>}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatYen(period.price)}
                  </td>
                  <td className="py-2">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </td>
                  <td className="py-2">
                    {isDeleting ? (
                      <PeriodDeleteConfirm
                        productCd={detail.productCd}
                        periodId={period.periodId}
                        version={detail.version}
                        onSuccess={close}
                        onCancel={close}
                      />
                    ) : (
                      <div className="flex gap-2 justify-end">
                        {auth.editable && (
                          <button
                            type="button"
                            onClick={() => setMode({ kind: "edit", periodId: period.periodId })}
                            className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                          >
                            編集
                          </button>
                        )}
                        {auth.endDatable && (
                          <button
                            type="button"
                            onClick={() => setMode({ kind: "endDate", periodId: period.periodId })}
                            className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                          >
                            適用終了
                          </button>
                        )}
                        {auth.deletable && (
                          <button
                            type="button"
                            onClick={() => setMode({ kind: "delete", periodId: period.periodId })}
                            className="text-red-600 hover:text-red-800 hover:underline text-sm"
                          >
                            削除
                          </button>
                        )}
                        {!auth.editable && !auth.endDatable && !auth.deletable && (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-500">
          適用期間が未設定です。共通売単価が無いと価格決定が解決できません。
        </p>
      )}

      {/* 登録／編集／適用終了の単一フォーム（決定3）。編集系で対象行が消えていたら表示しない。 */}
      {formMode != null && (formMode.kind === "new" || formPeriod != null) && (
        <PeriodForm
          productCd={detail.productCd}
          version={detail.version}
          mode={formMode.kind}
          period={formPeriod}
          onSuccess={close}
          onCancel={close}
        />
      )}
    </div>
  );
}
