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
    hasPeripheral: false,
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

describe("LineTable 単価乖離・解決不能バッジ（#593）", () => {
  it("乖離行に『単価乖離』バッジを出し、現在値・符号つき差額をツールチップに載せる", () => {
    render(
      <LineTable
        lines={[
          line({
            itemName: "乖離行",
            unitPrice: 1000,
            unitPriceDivergence: { kind: "DIVERGENT", currentUnitPrice: 1200, difference: 200 },
          }),
        ]}
        activeRowId={null}
        onSelectRow={() => {}}
      />
    );

    const badge = screen.getByText("単価乖離");
    expect(badge).toBeInTheDocument();
    const tooltip = badge.getAttribute("title") ?? "";
    expect(tooltip).toContain("1,200円");
    expect(tooltip).toContain("+200円");
  });

  it("解決不能行に『解決不能』バッジと説明ツールチップを出す", () => {
    render(
      <LineTable
        lines={[line({ itemName: "解決不能行", unitPriceDivergence: { kind: "UNRESOLVABLE" } })]}
        activeRowId={null}
        onSelectRow={() => {}}
      />
    );

    const badge = screen.getByText("解決不能");
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute("title") ?? "").not.toBe("");
  });

  it("乖離なし（NONE）行にはバッジを出さない", () => {
    render(
      <LineTable
        lines={[line({ itemName: "一致行", unitPriceDivergence: { kind: "NONE" } })]}
        activeRowId={null}
        onSelectRow={() => {}}
      />
    );

    expect(screen.queryByText("単価乖離")).not.toBeInTheDocument();
    expect(screen.queryByText("解決不能")).not.toBeInTheDocument();
  });
});

describe("LineTable 価格調整モード（priceEdit・#390）", () => {
  it("priceEdit で掛率・明細値引は編集セル、単価は読み取り専用表示（#430・ADR-0064）", () => {
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

    // 単価は価格決定で確定・固定のため入力欄を出さず、確定単価を表示する（ADR-0064）。
    const unitPriceCell = screen.getByLabelText("単価（明細Y）");
    expect(unitPriceCell.tagName).not.toBe("INPUT");
    expect(unitPriceCell).toHaveTextContent("1,000円");

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

    // 編集可能な価格入力は掛率（単価は読み取り専用に変わった・#430）。
    expect(screen.getByLabelText("掛率（併用）")).toBeInTheDocument();
    expect(screen.getByLabelText("顧客メモ（併用）")).toBeInTheDocument();
  });
});
