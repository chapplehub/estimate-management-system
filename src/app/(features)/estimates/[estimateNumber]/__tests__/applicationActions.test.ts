import { ConflictError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { previewApplication, submitApplication } from "../actions";

/**
 * 申請 Server Action のマッピング契約テスト（#494・Step 4）。
 *
 * 「operator はセッション注入で client 入力を無視する」「estimateId は estimateNumber から
 * 再解決する」「version は client エコーでサーバは読み直さない（TOCTOU・ADR-0068）」を固定する。
 * 実 Prisma には触れず、Composition Root（factory）とセッションをモックして配線だけを検証する。
 */

const verifySession = vi.fn();
vi.mock("@/app/_lib/verifyAuthentication", () => ({
  verifySession: () => verifySession(),
}));

const getEstimateDetail = vi.fn();
vi.mock("@subdomains/estimate/application/factories/estimateQueryFactory", () => ({
  getEstimateDetailQueryFactory: () => ({ execute: getEstimateDetail }),
}));

const previewExecute = vi.fn();
vi.mock("@subdomains/estimate/application/factories/previewApplicationQueryFactory", () => ({
  previewApplicationQueryFactory: () => ({ execute: previewExecute }),
}));

const submitExecute = vi.fn();
vi.mock("@subdomains/estimate/application/factories/submitApplicationCommandFactory", () => ({
  submitApplicationCommandFactory: () => ({ execute: submitExecute }),
}));

const SESSION_EMPLOYEE_ID = "emp-session-001";

beforeEach(() => {
  vi.clearAllMocks();
  verifySession.mockResolvedValue({ user: { employeeId: SESSION_EMPLOYEE_ID } });
  getEstimateDetail.mockResolvedValue({ estimateId: "est-resolved-001", version: 999 });
});

describe("previewApplication", () => {
  it("operator をセッションから注入し estimateId を estimateNumber から再解決する", async () => {
    previewExecute.mockResolvedValue({
      kind: "EXEMPT",
      reason: "BELOW_THRESHOLD",
      reasonLabel: "10万円未満",
    });

    const result = await previewApplication("N0001", "var-1");

    expect(getEstimateDetail).toHaveBeenCalledWith({ estimateNumber: "N0001" });
    expect(previewExecute).toHaveBeenCalledWith({
      estimateId: "est-resolved-001",
      variationId: "var-1",
      operatorEmployeeId: SESSION_EMPLOYEE_ID,
    });
    expect(result).toEqual({
      success: true,
      data: { kind: "EXEMPT", reason: "BELOW_THRESHOLD", reasonLabel: "10万円未満" },
    });
  });

  it("session.user.employeeId が null ならクエリを呼ばずエラーメッセージを返す", async () => {
    verifySession.mockResolvedValue({ user: { employeeId: null } });

    const result = await previewApplication("N0001", "var-1");

    expect(previewExecute).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("申請者");
    }
  });

  it("見積が見つからなければエラーメッセージを返す", async () => {
    getEstimateDetail.mockResolvedValue(null);

    const result = await previewApplication("N0001", "var-1");

    expect(previewExecute).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});

describe("submitApplication", () => {
  it("operator をセッション注入・estimateId を再解決し version は client 値をそのまま渡す", async () => {
    submitExecute.mockResolvedValue({
      kind: "ApplicationSubmitted",
      applicationId: "app-1",
      finalApprovalPositionId: "pos-1",
      attempt: 1,
    });

    const result = await submitApplication("N0001", "var-1", 7);

    expect(getEstimateDetail).toHaveBeenCalledWith({ estimateNumber: "N0001" });
    // version はサーバの DTO(version:999)ではなく client エコー値 7 を渡す（TOCTOU・ADR-0068）。
    expect(submitExecute).toHaveBeenCalledWith({
      estimateId: "est-resolved-001",
      variationId: "var-1",
      operatorEmployeeId: SESSION_EMPLOYEE_ID,
      version: 7,
    });
    expect(result).toEqual({
      success: true,
      data: {
        kind: "ApplicationSubmitted",
        applicationId: "app-1",
        finalApprovalPositionId: "pos-1",
        attempt: 1,
      },
    });
  });

  it("ConflictError は handleCommandError 経由でメッセージ化する", async () => {
    submitExecute.mockRejectedValue(new ConflictError("他の操作で見積が更新されました"));

    const result = await submitApplication("N0001", "var-1", 7);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("他の操作で見積が更新されました");
    }
  });

  it("BusinessRuleViolationError は handleCommandError 経由でメッセージ化する", async () => {
    submitExecute.mockRejectedValue(
      new BusinessRuleViolationError("既に前進しているバリエーションがあります（1見積1前進）")
    );

    const result = await submitApplication("N0001", "var-1", 7);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("既に前進しているバリエーションがあります（1見積1前進）");
    }
  });

  it("session.user.employeeId が null ならコマンドを呼ばずエラーメッセージを返す", async () => {
    verifySession.mockResolvedValue({ user: { employeeId: null } });

    const result = await submitApplication("N0001", "var-1", 7);

    expect(submitExecute).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});
