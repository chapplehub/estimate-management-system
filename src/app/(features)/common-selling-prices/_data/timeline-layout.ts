/**
 * 共通販売単価 適用期間のタイムライン帯レイアウト算出（純関数・#475）。
 *
 * 半開区間 `[開始, 終了)` の連なりを時間軸の帯として可視化するための位置（left%/width%）を計算する。
 * 副作用のないプレゼンテーション計算のため、描画（PriceTimeline）から分離して単体テスト可能にする
 * （FE 述語ヘルパ period-rules.ts と同じ配置慣習）。プロトタイプ
 * （docs/design/common-selling-price-maintenance/共通売単価 保守画面.dc.html）の線形マッピングを踏襲。
 *
 * 状態（active/future/expired）は BE 編集読みモデルが参照日基準で算出済みの値をそのまま使う（#473）。
 * 今日マーカーの基準日（referenceDate）は status 算出と同一の基準日を呼び出し側から受け取り、帯の色分けと
 * マーカー位置を必ず整合させる（client で new Date() を再計算しない）。
 */

import type { CommonSellingPriceEditPeriodDTO } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceEditDTO";
import { formatYenFromDecimal } from "../_components/formatYen";

/** 1本の帯の描画情報（%は 0–100 の数値・呼び出し側で `${leftPct}%` に整形）。 */
export interface TimelineBar {
  periodId: string;
  /** 軸左端からの開始位置（%）。 */
  leftPct: number;
  /** 帯の幅（%・視認性のため最小 3%）。 */
  widthPct: number;
  status: CommonSellingPriceEditPeriodDTO["status"];
  /** 帯内に表示する売単価ラベル（テーブルと同じ整形）。 */
  priceLabel: string;
}

/** タイムライン全体のレイアウト。periods が空なら bars は空配列（帯を描かない）。 */
export interface TimelineLayout {
  bars: TimelineBar[];
  /** 今日マーカーの軸位置（%）。 */
  todayPct: number;
  /** 軸左端の日付ラベル `YYYY/MM/DD`（periods 空なら空文字）。 */
  axisStart: string;
  /** 軸右端の日付ラベル `YYYY/MM/DD`（periods 空なら空文字）。 */
  axisEnd: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** 軸両端の余白（下限。期間が短くても最低これだけ空ける）。 */
const MIN_PAD_MS = 30 * DAY_MS;
/** 帯が潰れないための最小幅（%）。 */
const MIN_WIDTH_PCT = 3;

/** 暦日文字列 `YYYY-MM-DD` を UTC ミリ秒へ（実行環境 TZ 非依存）。 */
function parseDay(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

/** UTC ミリ秒を `YYYY/MM/DD` 表示へ。 */
function formatDay(ms: number): string {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const date = String(d.getUTCDate()).padStart(2, "0");
  return `${year}/${month}/${date}`;
}

/** 小数第2位までに丸める（float ノイズを抑え、テストを決定的にする）。 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 期間配列と参照日（今日）からタイムライン帯のレイアウトを算出する。
 *
 * 軸範囲は全期間の最小開始〜最大終了に今日を含め、両端に余白（範囲の6%か最低30日）を足して決める。
 * 無期限（end === null）の帯は軸右端まで伸ばす。今日が全期間の外にあっても軸内に収まるよう、
 * lo/hi の双方を今日まで拡張する（プロトは hi のみ拡張だったが、参照日マーカーを常に可視にするため両端に拡張）。
 */
export function computeTimelineLayout(
  periods: CommonSellingPriceEditPeriodDTO[],
  referenceDate: string
): TimelineLayout {
  if (periods.length === 0) {
    return { bars: [], todayPct: 50, axisStart: "", axisEnd: "" };
  }

  const today = parseDay(referenceDate);
  const starts = periods.map((p) => parseDay(p.start));
  const ends = periods.map((p) => (p.end == null ? parseDay(p.start) : parseDay(p.end)));

  let lo = Math.min(...starts, today);
  let hi = Math.max(...ends, today);
  const pad = Math.max((hi - lo) * 0.06, MIN_PAD_MS);
  lo -= pad;
  hi += pad;
  const span = hi - lo || 1;
  const pct = (t: number): number => ((t - lo) / span) * 100;

  const bars: TimelineBar[] = periods.map((p) => {
    const startN = parseDay(p.start);
    const endN = p.end == null ? hi : parseDay(p.end);
    const leftPct = pct(startN);
    const widthPct = Math.max(pct(endN) - leftPct, MIN_WIDTH_PCT);
    return {
      periodId: p.periodId,
      leftPct: round2(leftPct),
      widthPct: round2(widthPct),
      status: p.status,
      priceLabel: formatYenFromDecimal(p.sellingPrice),
    };
  });

  return {
    bars,
    todayPct: round2(pct(today)),
    axisStart: formatDay(lo),
    axisEnd: formatDay(hi),
  };
}
