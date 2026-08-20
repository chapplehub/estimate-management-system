import { describe, expect, it } from "vitest";
import { approvalStepStatusBadgeToneOf } from "./approvalStepStatusBadge";

/**
 * 承認ステップ状態（4値・{@link ApprovalStepStatusCode}）→ バッジ色調の写像。
 * 申請状態と別概念のため別関数だが、色語彙（tone）は共通層で単一ソース化する。
 */
describe("approvalStepStatusBadgeToneOf", () => {
  it("NOT_STARTED（未着手）は neutral", () => {
    expect(approvalStepStatusBadgeToneOf("NOT_STARTED")).toBe("neutral");
  });

  it("AWAITING（承認待ち）は info", () => {
    expect(approvalStepStatusBadgeToneOf("AWAITING")).toBe("info");
  });

  it("APPROVED（承認済）は success", () => {
    expect(approvalStepStatusBadgeToneOf("APPROVED")).toBe("success");
  });

  it("REJECTED（差戻）は warning", () => {
    expect(approvalStepStatusBadgeToneOf("REJECTED")).toBe("warning");
  });
});
