import type { CSSProperties } from "react";
import type { CommonSellingPricePeriodStatus } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceEditDTO";
import type { TimelineLayout } from "../_data/timeline-layout";

/**
 * 適用期間タイムライン帯（#475・純プレゼンテーション）。
 *
 * computeTimelineLayout の算出結果を受けて、各期間を時間軸の帯として描画する。半開区間の連続・隙間・
 * 無期限（軸右端まで）を視覚化し、参照日（今日）を赤マーカーで示す。状態（active/future/expired）は
 * BE 算出値をそのまま色分けに使う（現在有効=緑／将来=青／失効=灰・プロト踏襲）。hooks を持たないため
 * "use client" は付けない（client の PeriodDetailPanel から利用される）。
 */

/** 状態→帯のパレット（プロトの timeline bars と同一の配色）。 */
const STATUS_PALETTE: Record<
  CommonSellingPricePeriodStatus,
  { bg: string; border: string; fg: string }
> = {
  active: { bg: "#CDEAD6", border: "#8FCFA4", fg: "#1E7A3D" },
  future: { bg: "#D6E2FB", border: "#A9C2F1", fg: "#2563EB" },
  expired: { bg: "#E5E8EB", border: "#C7CCD2", fg: "#6B7280" },
};

/** 凡例の並び（現在有効／失効／将来・プロトの並び順）。 */
const LEGEND_ITEMS: { status: CommonSellingPricePeriodStatus; label: string }[] = [
  { status: "active", label: "現在有効" },
  { status: "expired", label: "失効" },
  { status: "future", label: "将来" },
];

type Props = {
  layout: TimelineLayout;
};

export function PriceTimeline({ layout }: Props) {
  const { bars, todayPct, axisStart, axisEnd } = layout;

  if (bars.length === 0) {
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
      {/* 帯トラック（相対配置の親。帯・今日マーカーを絶対配置で載せる）。 */}
      <div className="relative my-2 h-[74px]">
        {/* ベースライン。 */}
        <div className="absolute inset-x-0 top-[30px] h-0.5 bg-[#EAEDF0]" />

        {bars.map((bar) => {
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
              key={bar.periodId}
              data-testid="price-timeline-bar"
              className="absolute top-[18px] flex h-[26px] items-center justify-center overflow-hidden rounded-md border"
              style={barStyle}
            >
              <span className="whitespace-nowrap px-1.5 text-[11px] font-bold tabular-nums">
                {bar.priceLabel}
              </span>
            </div>
          );
        })}

        {/* 参照日（今日）マーカー。 */}
        <div
          data-testid="price-timeline-today"
          className="absolute top-2 bottom-2 w-0.5 bg-red-600"
          style={{ left: `${todayPct}%` }}
        />
        <div
          className="absolute -top-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-red-600"
          style={{ left: `${todayPct}%` }}
        >
          今日
        </div>
      </div>

      {/* 軸両端の日付ラベル。 */}
      <div className="flex justify-between text-[11px] tabular-nums text-gray-400">
        <span>{axisStart}</span>
        <span>{axisEnd}</span>
      </div>

      {/* 凡例。 */}
      <div
        data-testid="price-timeline-legend"
        className="mt-3.5 flex gap-4 text-[11px] text-gray-500"
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
      </div>
    </div>
  );
}
