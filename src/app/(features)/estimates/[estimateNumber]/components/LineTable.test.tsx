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

describe("LineTable 価格調整モード（priceEdit・#390）", () => {
  it("priceEdit で単価・掛率・明細値引が編集セルになり、変更で onChangePrice を呼ぶ", () => {
    const onChangePrice = vi.fn();
    render(
      <LineTable
        lines={[line({ itemName: "明細Y", quantity: 2, unitPrice: 1000 })]}
        activeRowId={null}
        onSelectRow={() => {}}
        priceEdit
        onChangePrice={onChangePrice}
      />
    );

    fireEvent.change(screen.getByLabelText("単価（明細Y）"), { target: { value: "1500" } });
    expect(onChangePrice).toHaveBeenCalledWith("item-1", { unitPrice: 1500 });

    fireEvent.change(screen.getByLabelText("掛率（明細Y）"), { target: { value: "0.9" } });
    expect(onChangePrice).toHaveBeenCalledWith("item-1", { discountRate: 0.9 });

    fireEvent.change(screen.getByLabelText("明細値引（明細Y）"), { target: { value: "100" } });
    expect(onChangePrice).toHaveBeenCalledWith("item-1", { itemDiscount: 100 });
  });

  it("priceEdit でも商品名・数量・単位は read-only（入力欄を出さない）", () => {
    render(
      <LineTable
        lines={[line({ itemName: "明細Z", quantity: 3 })]}
        activeRowId={null}
        onSelectRow={() => {}}
        priceEdit
        onChangePrice={() => {}}
      />
    );

    expect(screen.queryByLabelText("数量（明細Z）")).not.toBeInTheDocument();
    // 数量はテキストとして表示される
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("priceEdit で粗利列（改訂価格 − 行金額）を表示する", () => {
    // revisedDeliveryPrice 5000, 行金額 = floor(1500*2)=3000 → 粗利 2000
    render(
      <LineTable
        lines={[
          line({ itemName: "黒字", quantity: 2, unitPrice: 1500, revisedDeliveryPrice: 5000 }),
        ]}
        activeRowId={null}
        onSelectRow={() => {}}
        priceEdit
        onChangePrice={() => {}}
      />
    );

    expect(screen.getByText("2,000円")).toBeInTheDocument();
  });

  it("priceEdit で逆ザヤ（粗利 < 0）は赤字で表示する", () => {
    // revisedDeliveryPrice 2000, 行金額 3000 → 粗利 -1000（逆ザヤ）
    render(
      <LineTable
        lines={[
          line({ itemName: "赤字", quantity: 2, unitPrice: 1500, revisedDeliveryPrice: 2000 }),
        ]}
        activeRowId={null}
        onSelectRow={() => {}}
        priceEdit
        onChangePrice={() => {}}
      />
    );

    const grossCell = screen.getByText("-1,000円");
    expect(grossCell.className).toMatch(/text-red/);
  });

  it("priceEdit と memoEdit を併用でき、メモ textarea も価格入力欄も出る", () => {
    render(
      <LineTable
        lines={[line({ itemName: "併用" })]}
        activeRowId={null}
        onSelectRow={() => {}}
        priceEdit
        onChangePrice={() => {}}
        memoEdit
        onChangeMemo={() => {}}
      />
    );

    expect(screen.getByLabelText("単価（併用）")).toBeInTheDocument();
    expect(screen.getByLabelText("顧客メモ（併用）")).toBeInTheDocument();
  });
});
