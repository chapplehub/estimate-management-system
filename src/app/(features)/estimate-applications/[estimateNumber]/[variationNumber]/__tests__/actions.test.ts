import { ConflictError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveStep, rejectStep, withdrawApplication } from "../actions";

/**
 * 見積申請詳細の操作 Server Action のマッピング契約テスト（#575・Step 1）。
 *
 * 「operator はセッション注入で client 入力を無視する」「stepId / applicationId は identity で
 * BE が membership・本人性・version を再検証する」「expectedVersion は client エコーでサーバは
 * 読み直さない（TOCTOU・ADR-0068）」を固定する。承認は返却集約の applicationStatus から
 * outcome（最終承認 / 途中承認）を導出することも固定する。実 Prisma には触れず、Composition
 * Root（factory）とセッションをモックして配線だけを検証する（applicationActions.test.ts と同型）。
 */

const verifySession = vi.fn();
vi.mock("@/app/_lib/verifyAuthentication", () => ({
  verifySession: () => verifySession(),
}));

const approveExecute = vi.fn();
vi.mock("@subdomains/estimate/application/factories/approveStepCommandFactory", () => ({
  approveStepCommandFactory: () => ({ execute: approveExecute }),
}));

const rejectExecute = vi.fn();
vi.mock("@subdomains/estimate/application/factories/rejectStepCommandFactory", () => ({
  rejectStepCommandFactory: () => ({ execute: rejectExecute }),
}));

const withdrawExecute = vi.fn();
vi.mock("@subdomains/estimate/application/factories/withdrawApplicationCommandFactory", () => ({
  withdrawApplicationCommandFactory: () => ({ execute: withdrawExecute }),
}));

const SESSION_EMPLOYEE_ID = "emp-session-001";

beforeEach(() => {
  vi.clearAllMocks();
  verifySession.mockResolvedValue({ user: { employeeId: SESSION_EMPLOYEE_ID } });
});

describe("approveStep", () => {
  it("operator をセッション注入・stepId と expectedVersion を client エコーで渡す", async () => {
    approveExecute.mockResolvedValue({ applicationStatus: { value: "PENDING" } });

    await approveStep("step-1", 7);

    expect(approveExecute).toHaveBeenCalledWith({
      stepId: "step-1",
      approverEmployeeId: SESSION_EMPLOYEE_ID,
      expectedVersion: 7,
    });
  });

  it("全ステップ承認済（applicationStatus=APPROVED）なら outcome:APPROVED を返す", async () => {
    approveExecute.mockResolvedValue({ applicationStatus: { value: "APPROVED" } });

    const result = await approveStep("step-1", 7);

    expect(result).toEqual({ success: true, data: { outcome: "APPROVED" } });
  });

  it("まだ承認中（applicationStatus=PENDING）なら outcome:STILL_PENDING を返す", async () => {
    approveExecute.mockResolvedValue({ applicationStatus: { value: "PENDING" } });

    const result = await approveStep("step-1", 7);

    expect(result).toEqual({ success: true, data: { outcome: "STILL_PENDING" } });
  });

  it("session.user.employeeId が null ならコマンドを呼ばずエラーメッセージを返す", async () => {
    verifySession.mockResolvedValue({ user: { employeeId: null } });

    const result = await approveStep("step-1", 7);

    expect(approveExecute).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });

  it("ConflictError は handleCommandError 経由でメッセージ化する", async () => {
    approveExecute.mockRejectedValue(new ConflictError("他の操作で申請が更新されました"));

    const result = await approveStep("step-1", 7);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("他の操作で申請が更新されました");
    }
  });

  it("BusinessRuleViolationError は handleCommandError 経由でメッセージ化する", async () => {
    approveExecute.mockRejectedValue(
      new BusinessRuleViolationError("この操作を行う権限がありません")
    );

    const result = await approveStep("step-1", 7);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("この操作を行う権限がありません");
    }
  });
});

describe("rejectStep", () => {
  it("operator をセッション注入・comment を生文字列で・expectedVersion を client エコーで渡す", async () => {
    rejectExecute.mockResolvedValue({ applicationStatus: { value: "REJECTED" } });

    const result = await rejectStep("step-1", "金額の根拠を明記してください", 7);

    expect(rejectExecute).toHaveBeenCalledWith({
      stepId: "step-1",
      rejecterEmployeeId: SESSION_EMPLOYEE_ID,
      comment: "金額の根拠を明記してください",
      expectedVersion: 7,
    });
    expect(result).toEqual({ success: true });
  });

  it("ValidationError（空コメント等の VO すり抜け）は handleCommandError 経由でメッセージ化する", async () => {
    rejectExecute.mockRejectedValue(new ConflictError("他の操作で申請が更新されました"));

    const result = await rejectStep("step-1", "  ", 7);

    expect(result.success).toBe(false);
  });

  it("session.user.employeeId が null ならコマンドを呼ばずエラーメッセージを返す", async () => {
    verifySession.mockResolvedValue({ user: { employeeId: null } });

    const result = await rejectStep("step-1", "理由", 7);

    expect(rejectExecute).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});

describe("withdrawApplication", () => {
  it("operator をセッション注入・applicationId と expectedVersion を client エコーで渡す", async () => {
    withdrawExecute.mockResolvedValue({ applicationStatus: { value: "WITHDRAWN" } });

    const result = await withdrawApplication("app-1", 7);

    expect(withdrawExecute).toHaveBeenCalledWith({
      applicationId: "app-1",
      operatorEmployeeId: SESSION_EMPLOYEE_ID,
      expectedVersion: 7,
    });
    expect(result).toEqual({ success: true });
  });

  it("ConflictError（最終承認との競合等）は handleCommandError 経由でメッセージ化する", async () => {
    withdrawExecute.mockRejectedValue(new ConflictError("他の操作で申請が更新されました"));

    const result = await withdrawApplication("app-1", 7);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("他の操作で申請が更新されました");
    }
  });

  it("session.user.employeeId が null ならコマンドを呼ばずエラーメッセージを返す", async () => {
    verifySession.mockResolvedValue({ user: { employeeId: null } });

    const result = await withdrawApplication("app-1", 7);

    expect(withdrawExecute).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});
