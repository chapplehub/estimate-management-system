"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/app/_components/shadcnui/badge";
import type {
  CommonSellingPriceEditDTO,
  CommonSellingPricePeriodStatus,
} from "@subdomains/pricing/application/queries/dto/CommonSellingPriceEditDTO";
import { authorityFor } from "../_data/period-rules";
import { computeTimelineLayout } from "../_data/timeline-layout";
import { formatYenFromDecimal } from "../_components/formatYen";
import { PeriodDeleteConfirm } from "./PeriodDeleteConfirm";
import { PeriodForm } from "./PeriodForm";
import { PriceTimeline } from "./PriceTimeline";
import { ReviseForm } from "./ReviseForm";

/** BE 時点状態のラベルと Badge variant（現在有効=active/将来=future/失効=expired）。 */
const STATUS_BADGE: Record<
  CommonSellingPricePeriodStatus,
  { label: string; variant: "default" | "outline" | "secondary" }
> = {
  active: { label: "現在有効", variant: "default" },
  future: { label: "将来", variant: "outline" },
  expired: { label: "失効", variant: "secondary" },
};

/**
 * パネルの開閉モード（決定2: URLに載せずクライアント状態で保持）。
 * 対象は periodId で保持し、revalidate後の最新 detail から都度引き直す（stale回避）。
 */
type PanelMode =
  | { kind: "closed" }
  | { kind: "new" }
  | { kind: "edit"; periodId: string }
  | { kind: "endDate"; periodId: string }
  | { kind: "revise"; periodId: string }
  | { kind: "delete"; periodId: string };

type Props = {
  detail: CommonSellingPriceEditDTO;
  /** 管理者のみミューテーション系UI（新規追加・編集・適用終了・削除）を描画する。認可の正本はサーバー側 verifyAdmin。 */
  isAdmin: boolean;
  /** 今日マーカーの基準日（`YYYY-MM-DD`）。status 算出と同一基準日をサーバーから受け取る（#475）。 */
  referenceDate: string;
};

/**
 * UC-2 期間明細の表示＋UC-3/4/5 の操作配線（client wrapper）。
 *
 * 時点状態（現在有効/将来/失効）に応じて各行の編集/適用終了/削除ボタンを出し分け
 * （use-cases.md §7・authorityFor）、登録/編集/適用終了は単一 PeriodForm をモードで
 * 切り替えて下部パネルに表示する。削除は行内2段階確認（決定5）。
 */
export function PeriodDetailPanel({ detail, isAdmin, referenceDate }: Props) {
  const [mode, setMode] = useState<PanelMode>({ kind: "closed" });
  const close = useCallback(() => setMode({ kind: "closed" }), []);

  // タイムライン帯の表示トグル（決定: 既定は table＝帯なし。決定2 と同じくクライアント状態で保持）。
  const [showTimeline, setShowTimeline] = useState(false);

  // 編集系パネルの対象行を最新 detail から引く（削除済みなら閉じる）。
  const formMode =
    mode.kind === "new" || mode.kind === "edit" || mode.kind === "endDate" ? mode : null;
  const formPeriod =
    formMode != null && formMode.kind !== "new"
      ? detail.periods.find((p) => p.periodId === formMode.periodId)
      : undefined;

  // 改定パネルの対象（現在有効行）を最新 detail から引く（状態が変わっていたら閉じる）。
  const revisePeriod =
    mode.kind === "revise"
      ? detail.periods.find((p) => p.periodId === mode.periodId && p.status === "active")
      : undefined;

  return (
    <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-500">適用期間</h2>
        <div className="flex items-center gap-3">
          {/* 表示切替（テーブル／タイムライン）。タイムラインは付加式で、テーブルは常時表示のまま。 */}
          <div className="inline-flex rounded-md border border-gray-300 p-0.5 text-sm">
            <button
              type="button"
              aria-pressed={!showTimeline}
              onClick={() => setShowTimeline(false)}
              className={`rounded px-3 py-1 font-semibold ${
                showTimeline ? "text-gray-600 hover:bg-gray-100" : "bg-blue-500 text-white"
              }`}
            >
              テーブル
            </button>
            <button
              type="button"
              aria-pressed={showTimeline}
              onClick={() => setShowTimeline(true)}
              className={`rounded px-3 py-1 font-semibold ${
                showTimeline ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              タイムライン
            </button>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setMode({ kind: "new" })}
              className="bg-blue-500 hover:bg-blue-700 text-white text-sm font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              新規追加
            </button>
          )}
        </div>
      </div>

      {/* タイムライン帯（付加式・トグル ON 時のみ）。テーブルの上に重ねて期間の連続・隙間・無期限を可視化。 */}
      {showTimeline && (
        <PriceTimeline layout={computeTimelineLayout(detail.periods, referenceDate)} />
      )}

      {detail.periods.length > 0 ? (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-sm font-bold text-gray-700">適用開始日</th>
              <th className="py-2 text-sm font-bold text-gray-700">適用終了日</th>
              <th className="py-2 text-sm font-bold text-gray-700 text-right">共通販売単価</th>
              <th className="py-2 text-sm font-bold text-gray-700">状態</th>
              {isAdmin && <th className="py-2 text-sm font-bold text-gray-700 text-right">操作</th>}
            </tr>
          </thead>
          <tbody>
            {detail.periods.map((period) => {
              const badge = STATUS_BADGE[period.status];
              const auth = authorityFor(period.status);
              const isDeleting = mode.kind === "delete" && mode.periodId === period.periodId;
              return (
                <tr key={period.periodId} className="border-b">
                  <td className="py-2 tabular-nums">{period.start}</td>
                  <td className="py-2 tabular-nums">
                    {period.end ?? <span className="text-gray-500">無期限</span>}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatYenFromDecimal(period.sellingPrice)}
                  </td>
                  <td className="py-2">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </td>
                  {isAdmin && (
                    <td className="py-2">
                      {isDeleting ? (
                        <PeriodDeleteConfirm
                          productId={detail.productId}
                          productCode={detail.productCode}
                          periodId={period.periodId}
                          version={detail.version ?? 0}
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
                          {auth.revisable && (
                            <button
                              type="button"
                              onClick={() => setMode({ kind: "revise", periodId: period.periodId })}
                              className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                            >
                              改定
                            </button>
                          )}
                          {auth.endDatable && (
                            <button
                              type="button"
                              onClick={() =>
                                setMode({ kind: "endDate", periodId: period.periodId })
                              }
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
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-500">
          適用期間が未設定です。共通販売単価が無いと価格決定が解決できません。
        </p>
      )}

      {/* 登録／編集／適用終了の単一フォーム（決定3）。編集系で対象行が消えていたら表示しない。 */}
      {formMode != null && (formMode.kind === "new" || formPeriod != null) && (
        <PeriodForm
          productId={detail.productId}
          productCode={detail.productCode}
          version={detail.version}
          mode={formMode.kind}
          period={formPeriod}
          onSuccess={close}
          onCancel={close}
        />
      )}

      {/* 単価改定の専用フォーム（#474）。現在有効行が在るときのみ。version は集約が在るため非null。 */}
      {revisePeriod != null && detail.version != null && (
        <ReviseForm
          productId={detail.productId}
          productCode={detail.productCode}
          version={detail.version}
          currentPrice={revisePeriod.sellingPrice}
          onSuccess={close}
          onCancel={close}
        />
      )}
    </div>
  );
}
