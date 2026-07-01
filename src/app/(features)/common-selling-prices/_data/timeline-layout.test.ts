import { describe, expect, it } from "vitest";
import type { CommonSellingPriceEditPeriodDTO } from "@subdomains/pricing/application/queries/dto/CommonSellingPriceEditDTO";
import { computeTimelineLayout } from "./timeline-layout";

/**
 * タイムライン帯レイアウト算出（#475）の単体テスト。
 *
 * 半開区間の帯を軸へ線形マッピングする純関数の検証。%は軸範囲（両端に余白を含む）に対する相対位置で、
 * 具体値そのものより「順序・大小・境界（無期限は右端／最小幅／今日が範囲外でも軸内）」の不変を確かめる。
 */

function period(
  overrides: Partial<CommonSellingPriceEditPeriodDTO> &
    Pick<CommonSellingPriceEditPeriodDTO, "periodId" | "start" | "status">
): CommonSellingPriceEditPeriodDTO {
  return {
    end: null,
    sellingPrice: "1000.00",
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
        period({
          periodId: "p1",
          start: "2025-04-01",
          end: "2025-07-01",
          status: "expired",
        }),
        period({
          periodId: "p2",
          start: "2025-10-01",
          end: "2026-01-01",
          status: "expired",
        }),
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
        period({
          periodId: "p1",
          start: "2025-01-01",
          end: "9999-12-31",
          status: "active",
        }),
        // 1日だけの極短期間。
        period({
          periodId: "p2",
          start: "2025-06-01",
          end: "2025-06-02",
          status: "expired",
        }),
      ],
      "2026-06-27"
    );
    const shortBar = layout.bars.find((b) => b.periodId === "p2");
    expect(shortBar?.widthPct).toBeGreaterThanOrEqual(3);
  });

  it("今日が全期間より未来でも今日マーカーは軸内（0〜100%）に収まる", () => {
    const layout = computeTimelineLayout(
      [
        period({
          periodId: "p1",
          start: "2020-01-01",
          end: "2020-12-31",
          status: "expired",
        }),
      ],
      "2026-06-27"
    );
    expect(layout.todayPct).toBeGreaterThanOrEqual(0);
    expect(layout.todayPct).toBeLessThanOrEqual(100);
  });

  it("今日が全期間より過去（全て将来）でも今日マーカーは軸内に収まる", () => {
    const layout = computeTimelineLayout(
      [
        period({
          periodId: "p1",
          start: "2030-01-01",
          end: null,
          status: "future",
        }),
      ],
      "2026-06-27"
    );
    expect(layout.todayPct).toBeGreaterThanOrEqual(0);
    expect(layout.todayPct).toBeLessThanOrEqual(100);
  });

  it("BE 算出の状態（active/future/expired）と売単価ラベルを帯へそのまま載せる", () => {
    const layout = computeTimelineLayout(
      [
        period({
          periodId: "p1",
          start: "2025-01-01",
          end: "2025-06-01",
          status: "expired",
          sellingPrice: "1000.00",
        }),
        period({
          periodId: "p2",
          start: "2025-06-01",
          end: "2026-12-01",
          status: "active",
          sellingPrice: "1200.50",
        }),
        period({
          periodId: "p3",
          start: "2026-12-01",
          end: null,
          status: "future",
          sellingPrice: "1500.00",
        }),
      ],
      "2026-06-27"
    );
    expect(layout.bars.map((b) => b.status)).toEqual(["expired", "active", "future"]);
    expect(layout.bars.map((b) => b.priceLabel)).toEqual(["¥1,000", "¥1,200.5", "¥1,500"]);
  });
});
