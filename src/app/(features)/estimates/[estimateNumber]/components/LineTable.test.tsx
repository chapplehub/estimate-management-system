import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LineDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { LineTable } from "./LineTable";

/** テスト用 LineDTO ビルダ。 */
function line(overrides: Partial<LineDTO> = {}): LineDTO {
  return {
    kind: "line",
    itemId: "item-1",
    productId: "p1",
    productCode: "P001",
    productCategory: "INDIVIDUAL",
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

describe("LineTable メモ列", () => {
  it("read-only モードでは明細の顧客/社内メモをテキスト表示する（メモ未表示バグの修正）", () => {
    render(
      <LineTable
        lines={[line({ customerMemo: "顧客メモA", internalMemo: "社内メモA" })]}
        activeRowId={null}
        onSelectRow={() => {}}
      />
    );

    expect(screen.getByText("顧客メモA")).toBeInTheDocument();
    expect(screen.getByText("社内メモA")).toBeInTheDocument();
  });

  it("read-only モードでは textarea を出さない", () => {
    render(
      <LineTable
        lines={[line({ customerMemo: "顧客メモA" })]}
        activeRowId={null}
        onSelectRow={() => {}}
      />
    );

    expect(screen.queryByLabelText(/顧客メモ/)).not.toBeInTheDocument();
  });

  it("編集モードでは顧客/社内メモの textarea を出し、変更で onChangeMemo を呼ぶ", () => {
    const onChangeMemo = vi.fn();
    render(
      <LineTable
        lines={[line({ itemName: "明細X" })]}
        activeRowId={null}
        onSelectRow={() => {}}
        memoEdit
        onChangeMemo={onChangeMemo}
      />
    );

    fireEvent.change(screen.getByLabelText("顧客メモ（明細X）"), {
      target: { value: "新しい顧客メモ" },
    });
    expect(onChangeMemo).toHaveBeenCalledWith("item-1", { customerMemo: "新しい顧客メモ" });

    fireEvent.change(screen.getByLabelText("社内メモ（明細X）"), {
      target: { value: "新しい社内メモ" },
    });
    expect(onChangeMemo).toHaveBeenCalledWith("item-1", { internalMemo: "新しい社内メモ" });
  });
});
