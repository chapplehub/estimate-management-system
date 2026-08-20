import { ValidationError } from "@server/shared/errors/DomainError";
import { describe, expect, it } from "vitest";
import { ApplicablePeriod } from "../ApplicablePeriod";

describe("ApplicablePeriod", () => {
  describe("contains — 半開区間 [開始, 終了)", () => {
    it("区間内の日付を含む", () => {
      const period = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      expect(period.contains("2025-07-15")).toBe(true);
    });

    it("開始日は含む（下端は閉）", () => {
      const period = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      expect(period.contains("2025-07-01")).toBe(true);
    });

    it("終了日は含まない（上端は開）", () => {
      const period = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      expect(period.contains("2025-08-01")).toBe(false);
    });

    it("開始日より前は含まない", () => {
      const period = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      expect(period.contains("2025-06-30")).toBe(false);
    });

    it("無期限（end=null）は開始日以降をすべて含む", () => {
      const period = ApplicablePeriod.create({ start: "2025-07-01", end: null });
      expect(period.contains("2999-12-31")).toBe(true);
      expect(period.contains("2025-07-01")).toBe(true);
      expect(period.contains("2025-06-30")).toBe(false);
    });
  });

  describe("overlaps — 区間の重なり判定", () => {
    it("重なる区間どうしは true", () => {
      const a = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      const b = ApplicablePeriod.create({ start: "2025-07-15", end: "2025-09-01" });
      expect(a.overlaps(b)).toBe(true);
      expect(b.overlaps(a)).toBe(true);
    });

    it("隣接する区間は重ならない（半開ゆえ端点は共有しない）", () => {
      const a = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      const b = ApplicablePeriod.create({ start: "2025-08-01", end: "2025-09-01" });
      expect(a.overlaps(b)).toBe(false);
      expect(b.overlaps(a)).toBe(false);
    });

    it("離れた区間は重ならない", () => {
      const a = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      const b = ApplicablePeriod.create({ start: "2025-10-01", end: "2025-11-01" });
      expect(a.overlaps(b)).toBe(false);
    });

    it("無期限の区間は後続の全区間と重なる", () => {
      const unbounded = ApplicablePeriod.create({ start: "2025-07-01", end: null });
      const later = ApplicablePeriod.create({ start: "2030-01-01", end: "2030-02-01" });
      expect(unbounded.overlaps(later)).toBe(true);
      expect(later.overlaps(unbounded)).toBe(true);
    });

    it("両方が無期限なら重なる", () => {
      const a = ApplicablePeriod.create({ start: "2025-07-01", end: null });
      const b = ApplicablePeriod.create({ start: "2026-01-01", end: null });
      expect(a.overlaps(b)).toBe(true);
    });
  });

  describe("バリデーション", () => {
    it("ISO日付形式でない開始日は ValidationError", () => {
      expect(() => ApplicablePeriod.create({ start: "2025/07/01", end: null })).toThrow(
        ValidationError
      );
    });

    it("実在しない日付（2月30日）は ValidationError", () => {
      expect(() => ApplicablePeriod.create({ start: "2025-02-30", end: null })).toThrow(
        ValidationError
      );
    });

    it("ISO日付形式でない終了日は ValidationError", () => {
      expect(() => ApplicablePeriod.create({ start: "2025-07-01", end: "2025-8-1" })).toThrow(
        ValidationError
      );
    });

    it("開始日と終了日が同一（空区間）は ValidationError", () => {
      expect(() => ApplicablePeriod.create({ start: "2025-07-01", end: "2025-07-01" })).toThrow(
        ValidationError
      );
    });

    it("終了日が開始日より前（逆転区間）は ValidationError", () => {
      expect(() => ApplicablePeriod.create({ start: "2025-08-01", end: "2025-07-01" })).toThrow(
        ValidationError
      );
    });
  });

  describe("アクセサ・等価", () => {
    it("start / end を取り出せる（永続化用）", () => {
      const period = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      expect(period.start).toBe("2025-07-01");
      expect(period.end).toBe("2025-08-01");
    });

    it("無期限なら end は null", () => {
      const period = ApplicablePeriod.create({ start: "2025-07-01", end: null });
      expect(period.end).toBeNull();
    });

    it("開始・終了が同じなら等価", () => {
      const a = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      const b = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      expect(a.equals(b)).toBe(true);
    });

    it("終了が異なれば非等価（無期限と有界を区別）", () => {
      const a = ApplicablePeriod.create({ start: "2025-07-01", end: "2025-08-01" });
      const b = ApplicablePeriod.create({ start: "2025-07-01", end: null });
      expect(a.equals(b)).toBe(false);
    });
  });
});
