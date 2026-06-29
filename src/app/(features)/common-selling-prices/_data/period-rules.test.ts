import { describe, expect, it } from "vitest";
import {
  authorityFor,
  classifyState,
  hasOverlap,
  overlaps,
  type PeriodBounds,
} from "./period-rules";

/** 参照日（テスト固定値。本番コードの REFERENCE_DATE とは独立に注入できることの確認も兼ねる）。 */
const REF = "2026-06-27";

describe("classifyState", () => {
  it("参照日が開始日より前なら将来", () => {
    expect(classifyState({ startDate: "2026-07-01", endDate: null }, REF)).toBe("future");
  });

  it("参照日が期間内（開始 ≤ 今日 < 終了）なら現在有効", () => {
    expect(classifyState({ startDate: "2026-06-01", endDate: "2026-07-01" }, REF)).toBe("current");
  });

  it("開始日と参照日が同日なら現在有効（下端は含む）", () => {
    expect(classifyState({ startDate: REF, endDate: null }, REF)).toBe("current");
  });

  it("終了日と参照日が同日なら失効（上端は含まない＝半開区間）", () => {
    expect(classifyState({ startDate: "2026-06-01", endDate: REF }, REF)).toBe("lapsed");
  });

  it("参照日が終了日以降なら失効", () => {
    expect(classifyState({ startDate: "2025-01-01", endDate: "2026-01-01" }, REF)).toBe("lapsed");
  });

  it("無期限（endDate=null）は過去開始でも現在有効", () => {
    expect(classifyState({ startDate: "2024-01-01", endDate: null }, REF)).toBe("current");
  });
});

describe("overlaps", () => {
  const base: PeriodBounds = { startDate: "2026-01-01", endDate: "2026-06-01" };

  it("完全に分離した期間は重複しない", () => {
    expect(overlaps(base, { startDate: "2026-07-01", endDate: "2026-08-01" })).toBe(false);
  });

  it("一部が重なる期間は重複する", () => {
    expect(overlaps(base, { startDate: "2026-05-01", endDate: "2026-09-01" })).toBe(true);
  });

  it("境界が接するだけ（前の終了=次の開始）は重複しない（改定フロー）", () => {
    expect(overlaps(base, { startDate: "2026-06-01", endDate: "2026-09-01" })).toBe(false);
  });

  it("逆順で境界が接するだけも重複しない", () => {
    expect(overlaps({ startDate: "2026-06-01", endDate: null }, base)).toBe(false);
  });

  it("無期限期間は以降の全期間と重複する", () => {
    expect(
      overlaps(
        { startDate: "2026-01-01", endDate: null },
        { startDate: "2030-01-01", endDate: null }
      )
    ).toBe(true);
  });

  it("無期限期間でも開始前（接触）の期間とは重複しない", () => {
    expect(
      overlaps(
        { startDate: "2026-06-01", endDate: null },
        { startDate: "2026-01-01", endDate: "2026-06-01" }
      )
    ).toBe(false);
  });

  it("一方が他方を完全に内包する場合は重複する", () => {
    expect(overlaps(base, { startDate: "2026-02-01", endDate: "2026-03-01" })).toBe(true);
  });
});

describe("hasOverlap", () => {
  const existing = [
    { periodId: "p1", startDate: "2025-01-01", endDate: "2026-01-01" },
    { periodId: "p2", startDate: "2026-01-01", endDate: null },
  ];

  it("既存と重複する候補は true", () => {
    expect(hasOverlap({ startDate: "2026-06-01", endDate: "2026-09-01" }, existing)).toBe(true);
  });

  it("既存と接触するだけの候補は false", () => {
    expect(hasOverlap({ startDate: "2024-06-01", endDate: "2025-01-01" }, existing)).toBe(false);
  });

  it("自己除外したIDとの重複は無視する（編集時の自己衝突回避）", () => {
    // p2 自身を新しい境界に編集する想定: p2 を除外すれば p1 と接触のみで非重複
    expect(hasOverlap({ startDate: "2026-01-01", endDate: "2027-01-01" }, existing, "p2")).toBe(
      false
    );
  });

  it("自己除外しなければ自分自身と重複扱いになる", () => {
    expect(hasOverlap({ startDate: "2026-01-01", endDate: "2027-01-01" }, existing)).toBe(true);
  });
});

describe("authorityFor", () => {
  it("将来行は全項目編集可・適用終了不可・削除可", () => {
    expect(authorityFor("future")).toEqual({ editable: true, endDatable: false, deletable: true });
  });

  it("現在有効行は編集不可・適用終了のみ可・削除不可", () => {
    expect(authorityFor("current")).toEqual({
      editable: false,
      endDatable: true,
      deletable: false,
    });
  });

  it("失効行は何もできない", () => {
    expect(authorityFor("lapsed")).toEqual({
      editable: false,
      endDatable: false,
      deletable: false,
    });
  });
});
