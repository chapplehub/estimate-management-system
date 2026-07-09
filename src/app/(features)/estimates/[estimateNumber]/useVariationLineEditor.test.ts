import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductSelectionRow } from "../_shared/selectionColumns";
import { useVariationLineEditor, type LineEditorPriceContext } from "./useVariationLineEditor";
import type { WorkingSetGroup } from "./variationLines";

/**
 * 明細追加時の見積単価ライブ解決の振る舞い（#430・Step 7）。
 *
 * 「解決成功なら解決値を単価に充填して行追加」「解決不能なら 0 円行を作らず追加を拒否しエラー表示」
 * （ADR-0064）と、セットは「1構成でも不能なら展開ごと拒否し不能な構成名を列挙」を固定する。
 * 価格決定（Server Action）と商品スナップショット取得（selection-actions）はモックする。
 */

const resolveSellingPricesForDisplay = vi.fn();
vi.mock("../_shared/selling-price-actions", () => ({
  resolveSellingPricesForDisplay: (...args: unknown[]) => resolveSellingPricesForDisplay(...args),
}));

const getProductLineSnapshot = vi.fn();
const expandSetComponents = vi.fn();
const getProductSuggestions = vi.fn();
vi.mock("../_shared/selection-actions", () => ({
  getProductLineSnapshot: (...args: unknown[]) => getProductLineSnapshot(...args),
  expandSetComponents: (...args: unknown[]) => expandSetComponents(...args),
  getProductSuggestions: (...args: unknown[]) => getProductSuggestions(...args),
}));

const PRICE_CONTEXT: LineEditorPriceContext = {
  estimateDate: "2026-07-09",
  customerId: "cust-1",
  deliveryLocationId: "dloc-1",
  submissionType: "CUSTOMER",
};

function setup() {
  return renderHook(() =>
    useVariationLineEditor({
      initialNodes: [],
      initialOverallDiscount: 0,
      priceContext: PRICE_CONTEXT,
      taxRate: 0.1,
      taxRoundingType: "ROUND_DOWN",
    })
  );
}

function productRow(overrides: Partial<ProductSelectionRow> = {}): ProductSelectionRow {
  return { id: "p1", code: "P1", name: "商品A", category: "INDIVIDUAL", ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  getProductSuggestions.mockResolvedValue([]);
});

describe("通常商品の選択時の見積単価解決", () => {
  it("解決成功なら解決値を単価に充填して行を追加する", async () => {
    getProductLineSnapshot.mockResolvedValue({
      id: "p1",
      code: "P1",
      name: "商品A",
      category: "INDIVIDUAL",
      unit: "個",
    });
    resolveSellingPricesForDisplay.mockResolvedValue({ p1: 1500 });

    const { result } = setup();
    await act(async () => {
      await result.current.handleProductSelect([productRow()]);
    });

    expect(result.current.nodes).toHaveLength(1);
    const line = result.current.nodes[0];
    expect(line.kind).toBe("line");
    if (line.kind !== "line") return;
    expect(line.unitPrice).toBe(1500);
    expect(result.current.selectionError).toBeNull();
  });

  it("解決不能（null）なら行を追加せず、エラーに商品名を出す（ADR-0064）", async () => {
    getProductLineSnapshot.mockResolvedValue({
      id: "p1",
      code: "P1",
      name: "商品A",
      category: "INDIVIDUAL",
      unit: "個",
    });
    resolveSellingPricesForDisplay.mockResolvedValue({ p1: null });

    const { result } = setup();
    await act(async () => {
      await result.current.handleProductSelect([productRow()]);
    });

    expect(result.current.nodes).toHaveLength(0);
    expect(result.current.selectionError).toContain("商品A");
  });
});

describe("セット商品の選択時の見積単価解決", () => {
  const expanded = {
    productId: "set1",
    code: "SET1",
    name: "セットA",
    unit: "式",
    components: [
      {
        productId: "ca",
        code: "CA",
        name: "構成A",
        category: "INDIVIDUAL",
        unit: "個",
        quantity: 2,
        isActive: true,
      },
      {
        productId: "cb",
        code: "CB",
        name: "構成B",
        category: "CONSUMABLE",
        unit: "本",
        quantity: 1,
        isActive: true,
      },
    ],
  };

  it("全構成が解決できれば群を追加し、各構成に解決単価を充填する", async () => {
    expandSetComponents.mockResolvedValue(expanded);
    resolveSellingPricesForDisplay.mockResolvedValue({ ca: 500, cb: 300 });

    const { result } = setup();
    await act(async () => {
      await result.current.handleProductSelect([productRow({ id: "set1", category: "SET" })]);
    });

    expect(result.current.nodes).toHaveLength(1);
    const group = result.current.nodes[0] as WorkingSetGroup;
    expect(group.kind).toBe("setGroup");
    expect(group.components.map((c) => c.unitPrice)).toEqual([500, 300]);
    expect(result.current.selectionError).toBeNull();
  });

  it("1構成でも解決不能なら展開ごと拒否し、不能な構成名を列挙する", async () => {
    expandSetComponents.mockResolvedValue(expanded);
    resolveSellingPricesForDisplay.mockResolvedValue({ ca: 500, cb: null });

    const { result } = setup();
    await act(async () => {
      await result.current.handleProductSelect([productRow({ id: "set1", category: "SET" })]);
    });

    expect(result.current.nodes).toHaveLength(0);
    expect(result.current.selectionError).toContain("セットA");
    expect(result.current.selectionError).toContain("構成B");
    expect(result.current.selectionError).not.toContain("構成A");
  });
});
