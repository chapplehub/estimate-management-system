import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { ApplicationConfirmDialog } from "./ApplicationConfirmDialog";
import { previewApplication, submitApplication } from "./actions";

vi.mock("./actions", () => ({
  previewApplication: vi.fn(),
  submitApplication: vi.fn(),
}));

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockPreview = previewApplication as unknown as Mock;
const mockSubmit = submitApplication as unknown as Mock;

const baseProps = {
  estimateNumber: "EST-1",
  variationId: "v1",
  variationNumber: 1,
  version: 7,
  finalTotal: 330000,
  canApply: true,
  variationStatus: "ACTIVE",
  onSubmitFailure: vi.fn(),
};

const REQUIRED_PREVIEW = {
  success: true as const,
  data: {
    kind: "REQUIRED" as const,
    goalPositionId: "pos-9",
    goalPositionName: "部長",
    steps: [
      { order: 1, roleName: "営業一課長", positionName: "課長" },
      { order: 2, roleName: "営業部長", positionName: "部長" },
    ],
  },
};

function renderDialog(overrides: Partial<typeof baseProps> = {}) {
  return render(<ApplicationConfirmDialog {...baseProps} {...overrides} />);
}

describe("ApplicationConfirmDialog（申請プレビュー→確認）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("申請ボタンを押すと preview を呼び REQUIRED の承認チェーンと金額と確認ボタンを表示する", async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue(REQUIRED_PREVIEW);
    renderDialog();

    await user.click(screen.getByRole("button", { name: "申請" }));

    expect(mockPreview).toHaveBeenCalledWith("EST-1", "v1");
    await screen.findByText(/営業一課長（課長）/);
    expect(screen.getByText(/営業部長（部長）/)).toBeInTheDocument();
    expect(screen.getByText(/330,000円/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "申請する" })).toBeInTheDocument();
  });

  test("EXEMPT は免除理由 label と確認ボタンを表示する", async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue({
      success: true,
      data: { kind: "EXEMPT", reason: "BELOW_THRESHOLD", reasonLabel: "10万円未満" },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "申請" }));

    await screen.findByText(/10万円未満/);
    expect(screen.getByRole("button", { name: "申請する" })).toBeInTheDocument();
  });

  test("BLOCKED は reasonLabel を表示し確認ボタンを出さない", async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue({
      success: true,
      data: {
        kind: "BLOCKED",
        reason: "NO_SUPERIOR_ROLE",
        reasonLabel: "申請者に上位役割が設定されていないため申請できません",
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "申請" }));

    await screen.findByText(/申請者に上位役割が設定されていないため申請できません/);
    expect(screen.queryByRole("button", { name: "申請する" })).toBeNull();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
  });

  test("INACTIVE は label を表示し確認ボタンを出さない", async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue({
      success: true,
      data: {
        kind: "INACTIVE",
        label: "このバリエーションは無効化されています。画面を更新して最新の状態をご確認ください。",
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "申請" }));

    await screen.findByText(/無効化されています/);
    expect(screen.queryByRole("button", { name: "申請する" })).toBeNull();
  });

  test("申請するを押すと submit を version エコーで呼び、成功でモーダルを閉じ router.refresh する", async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue(REQUIRED_PREVIEW);
    mockSubmit.mockResolvedValue({
      success: true,
      data: {
        kind: "ApplicationSubmitted",
        applicationId: "a1",
        finalApprovalPositionId: "p1",
        attempt: 1,
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "申請" }));
    await user.click(await screen.findByRole("button", { name: "申請する" }));

    expect(mockSubmit).toHaveBeenCalledWith("EST-1", "v1", 7);
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("button", { name: "申請する" })).toBeNull());
  });

  test("submit 失敗は onSubmitFailure にメッセージを渡しモーダルを閉じる（refresh しない）", async () => {
    const user = userEvent.setup();
    const onSubmitFailure = vi.fn();
    mockPreview.mockResolvedValue(REQUIRED_PREVIEW);
    mockSubmit.mockResolvedValue({ success: false, error: "他の操作で見積が更新されました" });
    renderDialog({ onSubmitFailure });

    await user.click(screen.getByRole("button", { name: "申請" }));
    await user.click(await screen.findByRole("button", { name: "申請する" }));

    await waitFor(() =>
      expect(onSubmitFailure).toHaveBeenCalledWith("他の操作で見積が更新されました")
    );
    expect(mockRefresh).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("button", { name: "申請する" })).toBeNull());
  });

  test("preview 失敗（operator 未取得等）はモーダル内にメッセージを出す", async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue({
      success: false,
      error: "申請者の従業員情報が取得できないため申請できません。管理者にお問い合わせください。",
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "申請" }));

    await screen.findByText(/申請者の従業員情報が取得できない/);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  test("単価乖離・解決不能があると黄色の非ブロッキング警告バナーを出す（申請ボタンは活性のまま）", async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue({
      success: true,
      data: {
        ...REQUIRED_PREVIEW.data,
        unitPriceWarning: { divergentCount: 2, unresolvableCount: 1 },
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "申請" }));

    const banner = await screen.findByText(/単価乖離 2 件/);
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/解決不能 1 件/);
    // 非ブロッキング: 「申請する」は活性のまま。
    const submit = screen.getByRole("button", { name: "申請する" });
    expect(submit).toBeInTheDocument();
    expect(submit).not.toBeDisabled();
  });

  test("乖離ゼロ・解決不能ゼロなら警告バナーを出さない", async () => {
    const user = userEvent.setup();
    mockPreview.mockResolvedValue({
      success: true,
      data: {
        kind: "EXEMPT",
        reason: "BELOW_THRESHOLD",
        reasonLabel: "10万円未満",
        unitPriceWarning: { divergentCount: 0, unresolvableCount: 0 },
      },
    });
    renderDialog();

    await user.click(screen.getByRole("button", { name: "申請" }));

    await screen.findByText(/10万円未満/);
    expect(screen.queryByText(/単価乖離/)).not.toBeInTheDocument();
    expect(screen.queryByText(/解決不能/)).not.toBeInTheDocument();
  });

  test("canApply=false ではトリガーが無効化され状態に応じたツールチップを持つ", () => {
    const { rerender } = renderDialog({ canApply: false, variationStatus: "INACTIVE" });
    const button = screen.getByRole("button", { name: "申請" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "無効なバリエーションは申請できません");

    rerender(<ApplicationConfirmDialog {...baseProps} canApply={false} variationStatus="ACTIVE" />);
    expect(screen.getByRole("button", { name: "申請" })).toHaveAttribute(
      "title",
      "既に前進しているバリエーションがあるため申請できません（1見積1前進）"
    );
  });
});
