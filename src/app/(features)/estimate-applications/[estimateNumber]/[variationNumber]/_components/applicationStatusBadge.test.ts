import { describe, expect, it } from "vitest";
import { applicationStatusBadgeToneOf } from "./applicationStatusBadge";

/**
 * 申請状態（4値・{@link ApplicationStatusCode}）→ バッジ色調の写像。
 * バリエーション申請状態の重なる4値（badgeToneOf）と同じ色語彙で揃える。
 */
describe("applicationStatusBadgeToneOf", () => {
  it("PENDING（申請中）は info", () => {
    expect(applicationStatusBadgeToneOf("PENDING")).toBe("info");
  });

  it("APPROVED（承認済）は success", () => {
    expect(applicationStatusBadgeToneOf("APPROVED")).toBe("success");
  });

  it("REJECTED（差戻）は warning", () => {
    expect(applicationStatusBadgeToneOf("REJECTED")).toBe("warning");
  });

  it("WITHDRAWN（取下）は neutral", () => {
    expect(applicationStatusBadgeToneOf("WITHDRAWN")).toBe("neutral");
  });
});
