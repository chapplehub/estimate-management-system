import { describe, expect, it } from "vitest";
import { fromDateInputValue, toDateInputValue } from "../date";

describe("toDateInputValue（JST 固定で yyyy-mm-dd 整形）", () => {
  it("JST 0 時の Date をその暦日に整形する", () => {
    expect(toDateInputValue(new Date("2025-04-01T00:00:00+09:00"))).toBe("2025-04-01");
  });

  it("UTC 夜（=翌日 JST）の Date は JST の暦日に整形する（UTC 解釈の day-shift を起こさない）", () => {
    // 2025-03-31T15:30Z は JST では 2025-04-01 00:30 → "2025-04-01"。UTC 解釈なら "2025-03-31"。
    expect(toDateInputValue(new Date("2025-03-31T15:30:00Z"))).toBe("2025-04-01");
  });
});

describe("fromDateInputValue（yyyy-mm-dd を JST 0 時として解釈）", () => {
  it("入力日付文字列を JST 0 時の instant にする", () => {
    expect(fromDateInputValue("2025-04-01").getTime()).toBe(
      new Date("2025-04-01T00:00:00+09:00").getTime()
    );
  });

  it("toDateInputValue と往復しても JST 暦日が保たれる", () => {
    const original = new Date("2025-03-31T15:30:00Z"); // JST 2025-04-01
    expect(toDateInputValue(fromDateInputValue(toDateInputValue(original)))).toBe("2025-04-01");
  });
});
