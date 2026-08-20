import { describe, expect, it } from "vitest";
import type { TimelinePeriod } from "./timeline-layout";
import { computeTimelineLayout } from "./timeline-layout";

/**
 * タイムライン帯レイアウト算出（#475→#503 で _shared 昇格）の単体テスト。
 *
 * 半開区間の帯を軸へ線形マッピングする純関数の検証。%は軸範囲（両端に余白を含む）に対する相対位置で、
 * 具体値そのものより「順序・大小・境界（無期限は右端／最小幅／今日が範囲外でも軸内）」の不変を確かめる。
 * 入力は集約非依存の中立構造型 `TimelinePeriod`（`price` は10進文字列）で、共通売単価・原価いずれの
 * 編集読みモデルも呼び出し側で `price` へマップして渡す。
 */

function period(
  overrides: Partial<TimelinePeriod> & Pick<TimelinePeriod, "periodId" | "start" | "status">
): TimelinePeriod {
  return {
    end: null,
    price: "1000.00",
    ...overrides,
  };
}

describe("computeTimelineLayout", () => {
  it("periods が空なら帯なし・軸ラベルも空", () => {
    const layout = computeTimelineLayout([], "2026-06-27");
    expect(layout.bars).toEqual([]);
    expect(layout.axisStart).toBe("");
    expect(layout.axisEnd).toBe("");
    expect(layout.todayPct).toBe(50);
  });

  it("単一の無期限期間は軸右端（100%）まで伸びる", () => {
    const layout = computeTimelineLayout(
      [period({ periodId: "p1", start: "2025-04-01", end: null, status: "active" })],
      "2026-06-27"
    );
    expect(layout.bars).toHaveLength(1);
    const bar = layout.bars[0];
    expect(bar.status).toBe("active");
    // 無期限（+∞）は軸右端 hi ちょうどまで伸ばす。
    expect(bar.leftPct + bar.widthPct).toBeCloseTo(100, 5);
    // 開始位置は左余白のぶん 0% より右にある。
    expect(bar.leftPct).toBeGreaterThan(0);
  });

  it("隙間のある2期間は帯が重ならず、後続の帯がより右に置かれる", () => {
    const layout = computeTimelineLayout(
      [
        period({ periodId: "p1", start: "2025-04-01", end: "2025-07-01", status: "expired" }),
        period({ periodId: "p2", start: "2025-10-01", end: "2026-01-01", status: "expired" }),
      ],
      "2026-06-27"
    );
    const [first, second] = layout.bars;
    // 隙間（2025-07-01〜2025-10-01）があるため、先行帯の右端 < 後続帯の左端。
    expect(first.leftPct + first.widthPct).toBeLessThan(second.leftPct);
  });

  it("幅が極小の期間でも最小幅 3% を確保する", () => {
    const layout = computeTimelineLayout(
      [
        period({ periodId: "p1", start: "2025-01-01", end: "9999-12-31", status: "active" }),
        // 1日だけの極短期間。
        period({ periodId: "p2", start: "2025-06-01", end: "2025-06-02", status: "expired" }),
      ],
      "2026-06-27"
    );
    const shortBar = layout.bars.find((b) => b.periodId === "p2");
    expect(shortBar?.widthPct).toBeGreaterThanOrEqual(3);
  });

  it("今日が全期間より未来でも今日マーカーは軸内（0〜100%）に収まる", () => {
    const layout = computeTimelineLayout(
      [period({ periodId: "p1", start: "2020-01-01", end: "2020-12-31", status: "expired" })],
      "2026-06-27"
    );
    expect(layout.todayPct).toBeGreaterThanOrEqual(0);
    expect(layout.todayPct).toBeLessThanOrEqual(100);
  });

  it("今日が全期間より過去（全て将来）でも今日マーカーは軸内に収まる", () => {
    const layout = computeTimelineLayout(
      [period({ periodId: "p1", start: "2030-01-01", end: null, status: "future" })],
      "2026-06-27"
    );
    expect(layout.todayPct).toBeGreaterThanOrEqual(0);
    expect(layout.todayPct).toBeLessThanOrEqual(100);
  });

  it("BE 算出の状態（active/future/expired）と単価ラベルを帯へそのまま載せる", () => {
    const layout = computeTimelineLayout(
      [
        period({
          periodId: "p1",
          start: "2025-01-01",
          end: "2025-06-01",
          status: "expired",
          price: "1000.00",
        }),
        period({
          periodId: "p2",
          start: "2025-06-01",
          end: "2026-12-01",
          status: "active",
          price: "1200.50",
        }),
        period({
          periodId: "p3",
          start: "2026-12-01",
          end: null,
          status: "future",
          price: "1500.00",
        }),
      ],
      "2026-06-27"
    );
    expect(layout.bars.map((b) => b.status)).toEqual(["expired", "active", "future"]);
    expect(layout.bars.map((b) => b.priceLabel)).toEqual(["¥1,000", "¥1,200.5", "¥1,500"]);
  });
});

/**
 * 複数レーン共有軸対応（#507・得意先別販売単価 → #547 で複数従レーンへ一般化）。
 *
 * 主レーン（操作対象）と従レーン（フォールバック・表示専用）を同一の時間軸に重ねて対比するための拡張。
 * 第3引数 `secondaryLanes`（従レーンの配列）はオプションで、既存の単レーン呼び出し（共通売単価・原価）は
 * 後方互換のまま影響を受けない。全系列の和集合から軸範囲（axisStart/axisEnd/todayPct）を決め、各系列の
 * bars を同一の pct 写像に載せる（同じ日付は全レーンで同じ left% に揃う）。`secondaryBars` はレーンごとの配列。
 */
describe("computeTimelineLayout（複数レーン共有軸）", () => {
  it("従レーンを1本渡すと secondaryBars[0] を返し、軸は両系列の和集合から決まる", () => {
    // 主（得意先別）は 2026 に1本、従（共通）は 2020 に1本。従の開始が主より過去にあるため、
    // 和集合を取れば従の開始位置は主の開始位置より左（小さい left%）になる。
    const layout = computeTimelineLayout(
      [period({ periodId: "cust-1", start: "2026-01-01", end: null, status: "active" })],
      "2026-06-27",
      [[period({ periodId: "common-1", start: "2020-01-01", end: null, status: "active" })]]
    );

    expect(layout.secondaryBars).toHaveLength(1);
    expect(layout.secondaryBars[0].map((b) => b.periodId)).toEqual(["common-1"]);
    const primary = layout.bars[0];
    const secondary = layout.secondaryBars[0][0];
    // 共通（従）の開始 2020 は得意先別（主）の開始 2026 より過去 → より左に置かれる。
    expect(secondary.leftPct).toBeLessThan(primary.leftPct);
  });

  it("同じ開始日は主・従レーンで同じ left% に揃う（同一軸への配置）", () => {
    const layout = computeTimelineLayout(
      [period({ periodId: "cust-1", start: "2026-03-01", end: "2026-09-01", status: "active" })],
      "2026-06-27",
      [[period({ periodId: "common-1", start: "2026-03-01", end: null, status: "active" })]]
    );
    const primary = layout.bars[0];
    const secondary = layout.secondaryBars[0][0];
    expect(secondary.leftPct).toBeCloseTo(primary.leftPct, 5);
  });

  it("主レーンが空でも従レーンがあれば軸を描く（上書きなしのフォールバック表示）", () => {
    const layout = computeTimelineLayout([], "2026-06-27", [
      [period({ periodId: "common-1", start: "2025-04-01", end: null, status: "active" })],
    ]);
    expect(layout.bars).toEqual([]);
    expect(layout.secondaryBars[0].map((b) => b.periodId)).toEqual(["common-1"]);
    expect(layout.axisStart).not.toBe("");
    expect(layout.axisEnd).not.toBe("");
  });

  it("主・従の双方が空なら帯なし・軸ラベルも空", () => {
    const layout = computeTimelineLayout([], "2026-06-27", []);
    expect(layout.bars).toEqual([]);
    expect(layout.secondaryBars).toEqual([]);
    expect(layout.axisStart).toBe("");
    expect(layout.axisEnd).toBe("");
  });
});

/**
 * 複数従レーンの一般化（#547・納品先別販売単価）。
 *
 * 納品先別の価格決定は「納品先別 → 得意先別 → 共通」の3段フォールバック。タイムラインは主＝納品先別に
 * 従レーンを2本（得意先別・共通）重ねて対比する。第3引数を単一従レーンから**従レーンの配列**
 * `secondaryLanes: TimelinePeriod[][]` へ一般化し、`secondaryBars: TimelineBar[][]` をレーンごとに返す。
 * 軸範囲は主＋全従レーンの和集合から決め、全系列を同一の pct 写像に載せる（同じ日付は全レーンで同じ left%）。
 */
describe("computeTimelineLayout（複数従レーンの一般化）", () => {
  it("複数の従レーンを渡すと secondaryBars をレーンごとの配列で返す", () => {
    // 主=納品先別、従1=得意先別、従2=共通の3段フォールバックを同一軸へ重ねる。
    const layout = computeTimelineLayout(
      [period({ periodId: "loc-1", start: "2026-01-01", end: null, status: "active" })],
      "2026-06-27",
      [
        [period({ periodId: "cust-1", start: "2025-01-01", end: null, status: "active" })],
        [period({ periodId: "common-1", start: "2020-01-01", end: null, status: "active" })],
      ]
    );
    expect(layout.secondaryBars).toHaveLength(2);
    expect(layout.secondaryBars[0].map((b) => b.periodId)).toEqual(["cust-1"]);
    expect(layout.secondaryBars[1].map((b) => b.periodId)).toEqual(["common-1"]);
  });
});
