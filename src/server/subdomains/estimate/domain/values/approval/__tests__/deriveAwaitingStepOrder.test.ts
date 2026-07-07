import { describe, it, expect } from "vitest";
import { deriveAwaitingStepOrder } from "../deriveAwaitingStepOrder";

describe("deriveAwaitingStepOrder", () => {
  it("承認行の無いステップのうち最小の stepOrder を返す", () => {
    const steps = [
      { stepOrder: 1, hasApproval: true },
      { stepOrder: 2, hasApproval: false },
      { stepOrder: 3, hasApproval: false },
    ];
    expect(deriveAwaitingStepOrder(steps)).toBe(2);
  });

  it("全ステップに承認行があれば承認待ちは無く null を返す", () => {
    const steps = [
      { stepOrder: 1, hasApproval: true },
      { stepOrder: 2, hasApproval: true },
    ];
    expect(deriveAwaitingStepOrder(steps)).toBeNull();
  });

  it("ステップが空なら null を返す", () => {
    expect(deriveAwaitingStepOrder([])).toBeNull();
  });

  it("入力順が昇順でなくても最小 stepOrder を返す（走査順に依存しない）", () => {
    const steps = [
      { stepOrder: 3, hasApproval: false },
      { stepOrder: 1, hasApproval: false },
      { stepOrder: 2, hasApproval: false },
    ];
    expect(deriveAwaitingStepOrder(steps)).toBe(1);
  });

  it("先頭ステップが未承認なら最小 stepOrder（=先頭）を返す", () => {
    const steps = [
      { stepOrder: 1, hasApproval: false },
      { stepOrder: 2, hasApproval: false },
    ];
    expect(deriveAwaitingStepOrder(steps)).toBe(1);
  });
});
