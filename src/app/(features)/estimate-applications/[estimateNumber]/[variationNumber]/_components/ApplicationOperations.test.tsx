import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import type { ApplicationOperationsView } from "@subdomains/estimate/application/queries/dto/EstimateApplicationDetailDTO";
import { ApplicationOperations } from "./ApplicationOperations";
import { approveStep, rejectStep, withdrawApplication } from "../actions";

/**
 * 操作ブロック（承認/取下 確認・差戻 コメント入力）のコンポーネントテスト（#575・Step 2）。
 *
 * DTO の 3 フラグでボタンを出し分け、確認/入力ダイアログの確定で Server Action を呼び、
 * 成功トースト（承認は outcome で文言分岐）＋`router.refresh()`、失敗は入力保護で分岐
 * （承認/取下=閉じて refresh、差戻=ダイアログ保持＋コメント温存）することを固定する。
 */

vi.mock("../actions", () => ({
  approveStep: vi.fn(),
  rejectStep: vi.fn(),
  withdrawApplication: vi.fn(),
}));

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const mockApprove = approveStep as unknown as Mock;
const mockReject = rejectStep as unknown as Mock;
const mockWithdraw = withdrawApplication as unknown as Mock;

/** 承認/差戻が可能な operations（承認待ちステップの役割メンバー視点）。 */
const APPROVER_OPERATIONS: ApplicationOperationsView = {
  canApprove: true,
  canReject: true,
  canWithdraw: false,
  latestApplicationId: "app-1",
  awaitingStepId: "step-1",
  expectedVersion: 7,
};

/** 取下が可能な operations（申請者本人視点）。 */
const WITHDRAWER_OPERATIONS: ApplicationOperationsView = {
  canApprove: false,
  canReject: false,
  canWithdraw: true,
  latestApplicationId: "app-1",
  awaitingStepId: null,
  expectedVersion: 7,
};

function renderOperations(
  operations: ApplicationOperationsView = APPROVER_OPERATIONS,
  variationNumber = 1
) {
  return render(
    <ApplicationOperations operations={operations} variationNumber={variationNumber} />
  );
}

describe("ApplicationOperations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("最終承認（outcome=APPROVED）は承認済の文言でトーストし router.refresh する", async () => {
    const user = userEvent.setup();
    mockApprove.mockResolvedValue({ success: true, data: { outcome: "APPROVED" } });
    renderOperations();

    await user.click(screen.getByRole("button", { name: "承認" }));
    await user.click(await screen.findByRole("button", { name: "承認する" }));

    expect(mockApprove).toHaveBeenCalledWith("step-1", 7);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0][0]).toContain("承認済");
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  test("途中承認（outcome=STILL_PENDING）は次ステップに進んだ文言でトーストする", async () => {
    const user = userEvent.setup();
    mockApprove.mockResolvedValue({ success: true, data: { outcome: "STILL_PENDING" } });
    renderOperations();

    await user.click(screen.getByRole("button", { name: "承認" }));
    await user.click(await screen.findByRole("button", { name: "承認する" }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0][0]).toContain("次の承認ステップ");
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  test("承認失敗はダイアログを閉じエラートースト＋refresh で真実へ寄せる", async () => {
    const user = userEvent.setup();
    mockApprove.mockResolvedValue({ success: false, error: "他の操作で申請が更新されました" });
    renderOperations();

    await user.click(screen.getByRole("button", { name: "承認" }));
    await user.click(await screen.findByRole("button", { name: "承認する" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("他の操作で申請が更新されました"));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("button", { name: "承認する" })).toBeNull());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  test("差戻はコメントを渡して成功トースト＋refresh する", async () => {
    const user = userEvent.setup();
    mockReject.mockResolvedValue({ success: true });
    renderOperations();

    await user.click(screen.getByRole("button", { name: "差戻" }));
    await user.type(await screen.findByLabelText("差戻理由"), "金額の根拠を明記してください");
    await user.click(screen.getByRole("button", { name: "差し戻す" }));

    expect(mockReject).toHaveBeenCalledWith("step-1", "金額の根拠を明記してください", 7);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("差し戻しました"));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  test("差戻理由が空（trim 後空）の間は差し戻すボタンが無効", async () => {
    const user = userEvent.setup();
    renderOperations();

    await user.click(screen.getByRole("button", { name: "差戻" }));
    expect(await screen.findByRole("button", { name: "差し戻す" })).toBeDisabled();

    await user.type(screen.getByLabelText("差戻理由"), "   ");
    expect(screen.getByRole("button", { name: "差し戻す" })).toBeDisabled();

    await user.type(screen.getByLabelText("差戻理由"), "理由");
    expect(screen.getByRole("button", { name: "差し戻す" })).toBeEnabled();
  });

  test("差戻失敗はダイアログを保持し内部エラーを出しコメントを温存する（refresh しない）", async () => {
    const user = userEvent.setup();
    mockReject.mockResolvedValue({ success: false, error: "他の操作で申請が更新されました" });
    renderOperations();

    await user.click(screen.getByRole("button", { name: "差戻" }));
    await user.type(await screen.findByLabelText("差戻理由"), "根拠を明記してください");
    await user.click(screen.getByRole("button", { name: "差し戻す" }));

    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("他の操作で申請が更新されました");
    // ダイアログは開いたまま・コメントは温存・refresh しない。
    expect(screen.getByLabelText("差戻理由")).toHaveValue("根拠を明記してください");
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  test("差戻ダイアログを閉じて再度開いても入力したコメントが残る", async () => {
    const user = userEvent.setup();
    renderOperations();

    await user.click(screen.getByRole("button", { name: "差戻" }));
    await user.type(await screen.findByLabelText("差戻理由"), "書きかけの理由");
    // キャンセルで閉じる。
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    // 再度開く。
    await user.click(screen.getByRole("button", { name: "差戻" }));

    expect(await screen.findByLabelText("差戻理由")).toHaveValue("書きかけの理由");
  });

  test("取下は確認後に成功トースト＋refresh する", async () => {
    const user = userEvent.setup();
    mockWithdraw.mockResolvedValue({ success: true });
    renderOperations(WITHDRAWER_OPERATIONS);

    await user.click(screen.getByRole("button", { name: "取下" }));
    await user.click(await screen.findByRole("button", { name: "取り下げる" }));

    expect(mockWithdraw).toHaveBeenCalledWith("app-1", 7);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("取り下げました"));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  test("資格なし（3 フラグ全 false）では操作ボタンを一切出さない", () => {
    renderOperations({
      canApprove: false,
      canReject: false,
      canWithdraw: false,
      latestApplicationId: null,
      awaitingStepId: null,
      expectedVersion: null,
    });

    expect(screen.queryByRole("button", { name: "承認" })).toBeNull();
    expect(screen.queryByRole("button", { name: "差戻" })).toBeNull();
    expect(screen.queryByRole("button", { name: "取下" })).toBeNull();
  });
});
