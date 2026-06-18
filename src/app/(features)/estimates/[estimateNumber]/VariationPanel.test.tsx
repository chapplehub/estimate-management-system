import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import type {
  LineDTO,
  VariationDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { VariationPanel } from "./VariationPanel";
import { addVariation } from "./actions";

// Server Action をモック（VariationCreateForm / VariationEditForm が依存）。
vi.mock("./actions", () => ({
  addVariation: vi.fn(),
  updateVariationContent: vi.fn(),
}));

const mockAddVariation = addVariation as unknown as Mock;

/** テスト用 LineDTO ビルダ（改訂列なし＝編集可・複製可）。 */
function line(overrides: Partial<LineDTO> = {}): LineDTO {
  return {
    kind: "line",
    itemId: "item-1",
    productId: "p1",
    productCode: "P001",
    productCategory: "GENERAL",
    isActive: true,
    itemName: "通常明細",
    sortOrder: 1,
    quantity: 2,
    unit: "個",
    unitPrice: 1000,
    discountRate: 1.0,
    itemDiscount: 0,
    baseAmount: 2000,
    finalAmount: 2000,
    customerMemo: "",
    internalMemo: "",
    revisedDeliveryPrice: null,
    ...overrides,
  };
}

/** テスト用 VariationDTO ビルダ（既定: ACTIVE / 得意先向け / 改訂なし）。 */
function variation(overrides: Partial<VariationDTO> = {}): VariationDTO {
  return {
    variationId: "v1",
    variationNumber: 1,
    status: "ACTIVE",
    submissionType: "CUSTOMER",
    overallDiscount: 0,
    customerMemo: "",
    internalMemo: "",
    subtotal: 0,
    discountSubtotal: 0,
    finalSubtotal: 0,
    taxAmount: 0,
    finalTotal: 0,
    lines: [line()],
    ...overrides,
  };
}

/** VariationPanel の共通 props（バリエーション群だけ差し替える）。 */
function renderPanel(variations: VariationDTO[]) {
  return render(
    <VariationPanel
      estimateNumber="EST-0001"
      version={1}
      variations={variations}
      taxRate={0.1}
      taxRoundingType="ROUND_DOWN"
      hasRevision={false}
    />
  );
}

describe("VariationPanel（モード切替と提出区分の振る舞い・C3）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddVariation.mockResolvedValue(undefined);
  });

  test("[新規] ＋バリエーション追加で提出区分が選択式（既定=得意先向け・両宛先）で表示される", async () => {
    const user = userEvent.setup();
    renderPanel([variation()]);

    await user.click(screen.getByRole("button", { name: "＋バリエーション追加" }));

    const select = screen.getByLabelText("提出区分");
    expect(select).toHaveValue("CUSTOMER");
    expect(screen.getByRole("option", { name: "得意先向け" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "納品先向け" })).toBeInTheDocument();
  });

  test("[新規] 納品先向けを選んで保存すると FormData の提出区分が納品先向けで送られる", async () => {
    const user = userEvent.setup();
    renderPanel([variation()]);

    await user.click(screen.getByRole("button", { name: "＋バリエーション追加" }));
    await user.selectOptions(screen.getByLabelText("提出区分"), "DELIVERY_LOCATION");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "保存" }));
    });

    await waitFor(() => expect(mockAddVariation).toHaveBeenCalled());

    // bind(null, estimateNumber) のため引数は [estimateNumber, prevState, formData]。
    const formData = mockAddVariation.mock.calls[0][2] as FormData;
    expect(formData.get("submissionType")).toBe("DELIVERY_LOCATION");
  });

  test("[複製] 提出区分は固定ラベルで表示（選択不可）され、複製元の値がそのまま送られる", async () => {
    const user = userEvent.setup();
    renderPanel([variation({ submissionType: "DELIVERY_LOCATION" })]);

    await user.click(screen.getByRole("button", { name: "複製" }));

    // 固定ラベル表示＝引き継ぎ・変更不可。選択 UI（aria-label 付き select）は存在しない。
    expect(screen.getByText(/複製元から引き継ぎ・変更不可/)).toBeInTheDocument();
    expect(screen.queryByLabelText("提出区分")).toBeNull();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "保存" }));
    });

    await waitFor(() => expect(mockAddVariation).toHaveBeenCalled());

    const formData = mockAddVariation.mock.calls[0][2] as FormData;
    expect(formData.get("submissionType")).toBe("DELIVERY_LOCATION");
  });
});
