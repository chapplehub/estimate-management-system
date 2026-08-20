import { describe, expect, it } from "vitest";
import { toJstCalendarDay } from "../toJstCalendarDay";

describe("toJstCalendarDay", () => {
  it("UTC 15:00 は JST 翌日 0:00 なので翌日の暦日になる（off-by-one 境界）", () => {
    // UTC 2026-06-24 15:00:00 = JST 2026-06-25 00:00:00
    const date = new Date("2026-06-24T15:00:00Z");
    expect(toJstCalendarDay(date)).toBe("2026-06-25");
  });

  it("UTC 14:59:59 はまだ JST 当日 23:59:59 なので当日の暦日（境界の対）", () => {
    // UTC 2026-06-24 14:59:59 = JST 2026-06-24 23:59:59
    const date = new Date("2026-06-24T14:59:59Z");
    expect(toJstCalendarDay(date)).toBe("2026-06-24");
  });

  it("JST 0:00 ちょうど（+09:00 指定）はその日の暦日", () => {
    const date = new Date("2026-06-25T00:00:00+09:00");
    expect(toJstCalendarDay(date)).toBe("2026-06-25");
  });

  it("月末跨ぎ：UTC 2026-06-30 15:00 = JST 2026-07-01 で月が繰り上がる", () => {
    const date = new Date("2026-06-30T15:00:00Z");
    expect(toJstCalendarDay(date)).toBe("2026-07-01");
  });

  it("年末跨ぎ：UTC 2026-12-31 15:00 = JST 2027-01-01 で年が繰り上がる", () => {
    const date = new Date("2026-12-31T15:00:00Z");
    expect(toJstCalendarDay(date)).toBe("2027-01-01");
  });
});
