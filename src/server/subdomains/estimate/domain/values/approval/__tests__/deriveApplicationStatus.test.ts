import { describe, expect, it } from "vitest";
import { ApplicationStatus } from "../ApplicationStatus";
import { deriveApplicationStatus } from "../deriveApplicationStatus";

describe("deriveApplicationStatus（§3.6 申請の導出状態・純粋関数）", () => {
  it("取下行あり → WITHDRAWN（最優先。差戻・全承認より先）", () => {
    expect(
      deriveApplicationStatus({
        hasWithdrawal: true,
        hasAnyRejection: true,
        allStepsApproved: true,
      })
    ).toBe(ApplicationStatus.WITHDRAWN);
  });

  it("差戻行あり（取下なし）→ REJECTED（全承認より先）", () => {
    expect(
      deriveApplicationStatus({
        hasWithdrawal: false,
        hasAnyRejection: true,
        allStepsApproved: true,
      })
    ).toBe(ApplicationStatus.REJECTED);
  });

  it("全ステップ承認（取下・差戻なし）→ APPROVED", () => {
    expect(
      deriveApplicationStatus({
        hasWithdrawal: false,
        hasAnyRejection: false,
        allStepsApproved: true,
      })
    ).toBe(ApplicationStatus.APPROVED);
  });

  it("いずれの終端もなし → PENDING", () => {
    expect(
      deriveApplicationStatus({
        hasWithdrawal: false,
        hasAnyRejection: false,
        allStepsApproved: false,
      })
    ).toBe(ApplicationStatus.PENDING);
  });
});
