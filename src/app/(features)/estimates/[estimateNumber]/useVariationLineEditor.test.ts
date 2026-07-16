import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductSelectionRow } from "../_shared/selectionColumns";
import { useVariationLineEditor, type LineEditorPriceContext } from "./useVariationLineEditor";
import type { WorkingSetGroup } from "./variationLines";

/**
 * 明細追加時の見積単価ライブ解決の振る舞い（#430・Step 7）と、複数商品の一括追加（#618）。
 *
 * 「解決成功なら解決値を単価に充填して行追加」「解決不能なら 0 円行を作らず追加を拒否」（ADR-0064）と、
 * セットは「1構成でも不能なら展開ごと拒否し不能な構成名を列挙」を固定する。拒否は SelectionRejection の
 * 戻り値で表す（モーダル内に表示するため・ADR-20260716-r4d）ので、商品選択パスは selectionError を
 * 設定しない。価格決定（Server Action）と商品スナップショット取得（selection-actions）はモックする。
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

describe("複数商品の一括追加（#618）", () => {
  /** 通常商品のスナップショットを id から組み立てる（モーダルの表示順＝渡された行順の検証用）。 */
  function snapshotOf(id: string, name: string) {
    return { id, code: id.toUpperCase(), name, category: "INDIVIDUAL", unit: "個" };
  }

  it("3件選択したら3行すべてを表示順のまま追加し、最後の1件をアクティブにする", async () => {
    getProductLineSnapshot.mockImplementation(async (id: string) =>
      snapshotOf(id, { p1: "商品A", p2: "商品B", p3: "商品C" }[id]!)
    );
    resolveSellingPricesForDisplay.mockResolvedValue({ p1: 100, p2: 200, p3: 300 });

    const { result } = setup();
    await act(async () => {
      await result.current.handleProductSelect([
        productRow({ id: "p1", name: "商品A" }),
        productRow({ id: "p2", name: "商品B" }),
        productRow({ id: "p3", name: "商品C" }),
      ]);
    });

    expect(result.current.nodes).toHaveLength(3);
    expect(result.current.nodes.map((n) => (n.kind === "line" ? n.itemName : n.itemName))).toEqual([
      "商品A",
      "商品B",
      "商品C",
    ]);
    expect(result.current.nodes.map((n) => (n.kind === "line" ? n.unitPrice : null))).toEqual([
      100, 200, 300,
    ]);
    expect(result.current.activeRowId).toBe(result.current.nodes[2]?.rowId);
  });

  it("1件でも解決不能なら1行も追加せず、原因商品だけを invalidIds に載せて拒否する", async () => {
    getProductLineSnapshot.mockImplementation(async (id: string) =>
      snapshotOf(id, { p1: "商品A", p2: "商品B", p3: "商品C" }[id]!)
    );
    // 商品B だけ単価が無い（他の2件は解決できる）。
    resolveSellingPricesForDisplay.mockResolvedValue({ p1: 100, p2: null, p3: 300 });

    const { result } = setup();
    const rejection = await act(() =>
      result.current.handleProductSelect([
        productRow({ id: "p1", name: "商品A" }),
        productRow({ id: "p2", name: "商品B" }),
        productRow({ id: "p3", name: "商品C" }),
      ])
    );

    // 部分追加せず原子的に拒否する（解決できた商品A・商品Cも追加しない）。
    expect(result.current.nodes).toHaveLength(0);
    expect(rejection?.invalidIds).toEqual(["p2"]);
    expect(rejection?.message).toContain("商品B");
    expect(rejection?.message).not.toContain("商品A");
  });

  it("複数選択では周辺商品サジェストを出さない（単数 state の後勝ちを避ける）", async () => {
    getProductLineSnapshot.mockImplementation(async (id: string) =>
      snapshotOf(id, { p1: "商品A", p2: "商品B" }[id]!)
    );
    resolveSellingPricesForDisplay.mockResolvedValue({ p1: 100, p2: 200 });
    getProductSuggestions.mockResolvedValue([
      { id: "s1", code: "S1", name: "周辺商品", category: "INDIVIDUAL", unit: "個", quantity: 1 },
    ]);

    const { result } = setup();
    await act(async () => {
      await result.current.handleProductSelect([
        productRow({ id: "p1", name: "商品A" }),
        productRow({ id: "p2", name: "商品B" }),
      ]);
    });

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.suggestState).toBeNull();
    expect(getProductSuggestions).not.toHaveBeenCalled();
  });

  it("単一選択なら従来どおり周辺商品サジェストを出す", async () => {
    getProductLineSnapshot.mockResolvedValue(snapshotOf("p1", "商品A"));
    resolveSellingPricesForDisplay.mockResolvedValue({ p1: 100 });
    getProductSuggestions.mockResolvedValue([
      { id: "s1", code: "S1", name: "周辺商品", category: "INDIVIDUAL", unit: "個", quantity: 1 },
    ]);

    const { result } = setup();
    await act(async () => {
      await result.current.handleProductSelect([productRow({ id: "p1", name: "商品A" })]);
    });

    expect(result.current.suggestState?.mainName).toBe("商品A");
    expect(result.current.suggestState?.mainRowId).toBe(result.current.nodes[0]?.rowId);
  });
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

  it("解決不能（null）なら行を追加せず、商品名を添えた拒否を返す（ADR-0064）", async () => {
    getProductLineSnapshot.mockResolvedValue({
      id: "p1",
      code: "P1",
      name: "商品A",
      category: "INDIVIDUAL",
      unit: "個",
    });
    resolveSellingPricesForDisplay.mockResolvedValue({ p1: null });

    const { result } = setup();
    const rejection = await act(() => result.current.handleProductSelect([productRow()]));

    expect(result.current.nodes).toHaveLength(0);
    // エラーはモーダル内に出すため、バナー用の selectionError は使わない（#618・ADR-20260716-r4d）。
    expect(rejection?.message).toContain("商品A");
    expect(rejection?.invalidIds).toEqual(["p1"]);
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
    const rejection = await act(() =>
      result.current.handleProductSelect([productRow({ id: "set1", category: "SET" })])
    );

    expect(result.current.nodes).toHaveLength(0);
    expect(rejection?.message).toContain("セットA");
    expect(rejection?.message).toContain("構成B");
    expect(rejection?.message).not.toContain("構成A");
    // ハイライトはモーダルの一覧に存在する行＝セット商品の行に立てる（構成は一覧に現れない）。
    expect(rejection?.invalidIds).toEqual(["set1"]);
  });

  it("見積年月日未入力で解決が空マップを返す場合、NaN群を作らず展開ごと拒否する", async () => {
    // 見積年月日が空だと resolveSellingPricesForDisplay は空マップ {} を返し、
    // 各構成の単価が undefined になる。=== null では素通りして unitPrice: undefined の
    // 群を作り金額が NaN になっていた（通常明細・サジェストと非対称）。== null で拒否する。
    expandSetComponents.mockResolvedValue(expanded);
    resolveSellingPricesForDisplay.mockResolvedValue({});

    const { result } = setup();
    const rejection = await act(() =>
      result.current.handleProductSelect([productRow({ id: "set1", category: "SET" })])
    );

    expect(result.current.nodes).toHaveLength(0);
    expect(rejection?.message).toContain("セットA");
    expect(rejection?.message).toContain("構成A");
    expect(rejection?.message).toContain("構成B");
  });
});
