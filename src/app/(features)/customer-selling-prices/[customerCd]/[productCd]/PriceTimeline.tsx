import type { CSSProperties } from "react";
import type { PeriodStatus } from "../../../_shared/period-rules";
import type { TimelineBar, TimelineLayout } from "../../../_shared/timeline-layout";

/**
 * 適用期間タイムライン帯（#507・純プレゼンテーション・2レーン化）。
 *
 * computeTimelineLayout の算出結果（主 bars ＋ 従 secondaryBars を同一軸に載せた layout）を受けて、
 * 得意先別販売単価レーン（主・操作対象）と共通販売単価レーン（従・フォールバック・表示専用）を縦に積んで
 * 描画する。両レーンは同一の pct 写像に載るため、同じ日付は同じ横位置に揃い、上書き期間の外で何が適用される
 * か（＝共通へフォールバックする）を一目で対比できる。今日マーカー・軸ラベル・凡例は両レーンで共有する。
 *
 * 従（共通）レーンは表示のみ（クリック・操作なし・淡色で従属的に描画）。共通が未設定でもレーンを空表示する
 * だけで、警告等の新 UI は作らない（共通層の保守問題であり、この画面の関心ではない・決定）。hooks を持たない
 * ため "use client" は付けない（client の PeriodDetailPanel から利用される）。
 *
 * 共通販売単価（`common-selling-prices/[productCd]/PriceTimeline.tsx`）の同型写像に従レーンを足したもの。
 */

/** 状態→帯のパレット（プロトの timeline bars と同一の配色）。 */
const STATUS_PALETTE: Record<PeriodStatus, { bg: string; border: string; fg: string }> = {
  active: { bg: "#CDEAD6", border: "#8FCFA4", fg: "#1E7A3D" },
  future: { bg: "#D6E2FB", border: "#A9C2F1", fg: "#2563EB" },
  expired: { bg: "#E5E8EB", border: "#C7CCD2", fg: "#6B7280" },
};

/** 凡例の並び（現在有効／失効／将来・プロトの並び順）。 */
const LEGEND_ITEMS: { status: PeriodStatus; label: string }[] = [
  { status: "active", label: "現在有効" },
  { status: "expired", label: "失効" },
  { status: "future", label: "将来" },
];

type Props = {
  layout: TimelineLayout;
};

/** 主レーンの帯1本（BE 算出状態で色分け・単価ラベル付き）。 */
function PrimaryBar({ bar }: { bar: TimelineBar }) {
  const palette = STATUS_PALETTE[bar.status];
  const barStyle: CSSProperties = {
    left: `${bar.leftPct}%`,
    width: `${bar.widthPct}%`,
    backgroundColor: palette.bg,
    borderColor: palette.border,
    color: palette.fg,
  };
  return (
    <div
      data-testid="price-timeline-bar"
      className="absolute top-[18px] flex h-[26px] items-center justify-center overflow-hidden rounded-md border"
      style={barStyle}
    >
      <span className="whitespace-nowrap px-1.5 text-[11px] font-bold tabular-nums">
        {bar.priceLabel}
      </span>
    </div>
  );
}

/** 従（共通）レーンの帯1本。淡色・破線・低不透明度で従属＝表示専用を表す。 */
function SecondaryBar({ bar }: { bar: TimelineBar }) {
  const palette = STATUS_PALETTE[bar.status];
  const barStyle: CSSProperties = {
    left: `${bar.leftPct}%`,
    width: `${bar.widthPct}%`,
    backgroundColor: palette.bg,
    borderColor: palette.border,
    color: palette.fg,
  };
  return (
    <div
      data-testid="price-timeline-secondary-bar"
      className="absolute top-[18px] flex h-[26px] items-center justify-center overflow-hidden rounded-md border border-dashed opacity-60"
      style={barStyle}
    >
      <span className="whitespace-nowrap px-1.5 text-[11px] font-medium tabular-nums">
        {bar.priceLabel}
      </span>
    </div>
  );
}

export function PriceTimeline({ layout }: Props) {
  const { bars, secondaryBars, todayPct, axisStart, axisEnd } = layout;

  if (bars.length === 0 && secondaryBars.length === 0) {
    return (
      <div
        data-testid="price-timeline"
        className="mb-4 rounded border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500"
      >
        タイムラインに表示できる適用期間がありません。
      </div>
    );
  }

  return (
    <div
      data-testid="price-timeline"
      className="mb-4 rounded border border-gray-200 bg-white px-6 py-4"
    >
      {/* 主・従レーンを積む相対配置の親（今日マーカーを両レーンに跨いで載せる）。 */}
      <div className="relative">
        {/* 得意先別レーン（主・操作対象）。 */}
        <div className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-[11px] font-bold text-gray-600">得意先別</span>
          <div className="relative my-1 h-[62px] flex-1">
            <div className="absolute inset-x-0 top-[30px] h-0.5 bg-[#EAEDF0]" />
            {bars.map((bar) => (
              <PrimaryBar key={bar.periodId} bar={bar} />
            ))}
          </div>
        </div>

        {/* 共通レーン（従・淡色・表示専用のフォールバック層）。 */}
        <div className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-[11px] font-medium text-gray-400">共通</span>
          <div
            data-testid="price-timeline-secondary-lane"
            className="relative my-1 h-[62px] flex-1"
          >
            <div className="absolute inset-x-0 top-[30px] h-0.5 bg-[#EAEDF0]" />
            {secondaryBars.length > 0 ? (
              secondaryBars.map((bar) => <SecondaryBar key={bar.periodId} bar={bar} />)
            ) : (
              <span className="absolute top-[20px] left-2 text-[10px] text-gray-400">
                共通販売単価は未設定
              </span>
            )}
          </div>
        </div>

        {/* 参照日（今日）マーカー（両レーンを縦断）。左のレーンラベル幅ぶんインセットする。 */}
        <div className="pointer-events-none absolute inset-y-0 left-[76px] right-0">
          <div
            data-testid="price-timeline-today"
            className="absolute inset-y-1 w-0.5 bg-red-600"
            style={{ left: `${todayPct}%` }}
          />
          <div
            className="absolute -top-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-red-600"
            style={{ left: `${todayPct}%` }}
          >
            今日
          </div>
        </div>
      </div>

      {/* 軸両端の日付ラベル（レーンラベル幅ぶんインセット）。 */}
      <div className="ml-[76px] flex justify-between text-[11px] tabular-nums text-gray-400">
        <span>{axisStart}</span>
        <span>{axisEnd}</span>
      </div>

      {/* 凡例（色分けは両レーン共通。従レーンは淡色・破線＝表示専用の対比）。 */}
      <div
        data-testid="price-timeline-legend"
        className="mt-3.5 flex flex-wrap items-center gap-4 text-[11px] text-gray-500"
      >
        {LEGEND_ITEMS.map((item) => {
          const palette = STATUS_PALETTE[item.status];
          return (
            <span key={item.status} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-[3px] border"
                style={{ backgroundColor: palette.bg, borderColor: palette.border }}
              />
              {item.label}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5 text-gray-400">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-gray-400 opacity-60" />
          共通（フォールバック・表示専用）
        </span>
      </div>
    </div>
  );
}
