import { describe, expect, it } from "vitest";
import { OccurredAt } from "../OccurredAt";

describe("OccurredAt", () => {
  describe("from()", () => {
    it("生成元の Date を後から変異させても発生日時は変わらない（経路1：入口共有の遮断）", () => {
      const source = new Date("2026-06-19T09:00:00Z");
      const occurredAt = OccurredAt.from(source);

      source.setHours(0);

      expect(occurredAt.toDate().getTime()).toBe(new Date("2026-06-19T09:00:00Z").getTime());
    });
  });

  describe("toDate()", () => {
    it("戻り値の Date を変異させても発生日時は変わらない（経路2：出口共有の遮断）", () => {
      const occurredAt = OccurredAt.from(new Date("2026-06-19T09:00:00Z"));

      const exported = occurredAt.toDate();
      exported.setHours(0);

      expect(occurredAt.toDate().getTime()).toBe(new Date("2026-06-19T09:00:00Z").getTime());
    });
  });

  describe("equals()", () => {
    it("同じ瞬間を指す別インスタンスは等価", () => {
      const a = OccurredAt.from(new Date("2026-06-19T09:00:00Z"));
      const b = OccurredAt.from(new Date("2026-06-19T09:00:00Z"));

      expect(a.equals(b)).toBe(true);
    });

    it("異なる瞬間は非等価", () => {
      const a = OccurredAt.from(new Date("2026-06-19T09:00:00Z"));
      const b = OccurredAt.from(new Date("2026-06-19T10:00:00Z"));

      expect(a.equals(b)).toBe(false);
    });
  });

  describe("now()", () => {
    it("呼び出し時点の現在時刻で生成する", () => {
      const before = Date.now();
      const occurredAt = OccurredAt.now();
      const after = Date.now();

      const millis = occurredAt.toDate().getTime();
      expect(millis).toBeGreaterThanOrEqual(before);
      expect(millis).toBeLessThanOrEqual(after);
    });
  });
});
