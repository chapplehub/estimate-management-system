import { describe, expect, it } from "vitest";
import { ApprovalStepStatus } from "../ApprovalStepStatus";
import { deriveApprovalStepStatus } from "../deriveApprovalStepStatus";

describe("deriveApprovalStepStatus（§3.6 ステップの導出状態・純粋関数）", () => {
  it("差戻行あり → REJECTED（最優先。承認・進行より先）", () => {
    expect(
      deriveApprovalStepStatus({
        hasRejection: true,
        hasApproval: true,
        applicationIsPending: true,
        lowerStepsAllApproved: true,
      })
    ).toBe(ApprovalStepStatus.REJECTED);
  });

  it("承認行あり（差戻なし）→ APPROVED（進行より先）", () => {
    expect(
      deriveApprovalStepStatus({
        hasRejection: false,
        hasApproval: true,
        applicationIsPending: false,
        lowerStepsAllApproved: false,
      })
    ).toBe(ApprovalStepStatus.APPROVED);
  });

  it("決定なし＋申請 PENDING＋下位が全承認 → AWAITING", () => {
    expect(
      deriveApprovalStepStatus({
        hasRejection: false,
        hasApproval: false,
        applicationIsPending: true,
        lowerStepsAllApproved: true,
      })
    ).toBe(ApprovalStepStatus.AWAITING);
  });

  it("決定なし＋申請 PENDING＋下位に未承認あり → NOT_STARTED", () => {
    expect(
      deriveApprovalStepStatus({
        hasRejection: false,
        hasApproval: false,
        applicationIsPending: true,
        lowerStepsAllApproved: false,
      })
    ).toBe(ApprovalStepStatus.NOT_STARTED);
  });

  it("決定なし＋申請が PENDING でない → NOT_STARTED（下位全承認でも AWAITING にしない）", () => {
    expect(
      deriveApprovalStepStatus({
        hasRejection: false,
        hasApproval: false,
        applicationIsPending: false,
        lowerStepsAllApproved: true,
      })
    ).toBe(ApprovalStepStatus.NOT_STARTED);
  });
});
