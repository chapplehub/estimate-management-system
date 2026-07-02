import { describe, expect, it } from "vitest";
import { formatPeriod } from "./formatPeriod";

/**
 * 適用期間の表示整形の純関数テスト（#501）。
 * 終了日は半開区間の排他上端の生値をそのまま表示し（包含端への変換はしない）、
 * `end: null` は「無期限」と表示する（読みモデル DTO・編集画面と同一意味論）。
 */
describe("formatPeriod", () => {
  it("有界期間は開始日 〜 終了日（排他上端の生値）で表示する", () => {
    expect(formatPeriod("2026-01-01", "2026-12-31")).toBe("2026-01-01 〜 2026-12-31");
  });

  it("終了日が null なら開始日 〜 無期限で表示する", () => {
    expect(formatPeriod("2026-01-01", null)).toBe("2026-01-01 〜 無期限");
  });
});
