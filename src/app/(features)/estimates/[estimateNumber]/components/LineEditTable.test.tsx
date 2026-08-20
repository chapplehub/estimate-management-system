import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WorkingLine, WorkingNode, WorkingSetGroup } from "../variationLines";
import { LineEditTable } from "./LineEditTable";

/** テスト用 WorkingLine ビルダ。 */
function line(overrides: Partial<WorkingLine> = {}): WorkingLine {
  return {
    kind: "line",
    rowId: "row-1",
    productId: "p1",
    productCode: "P001",
    productCategory: "INDIVIDUAL",
    isActive: true,
    hasPeripheral: false,
    itemName: "通常明細",
    unit: "個",
    quantity: 2,
    unitPrice: 1000,
    discountRate: 1.0,
    itemDiscount: 0,
    customerMemo: "",
    internalMemo: "",
    ...overrides,
  };
}

/** テスト用 WorkingSetGroup ビルダ（構成明細を入れ子に持つ）。 */
function setGroup(overrides: Partial<WorkingSetGroup> = {}): WorkingSetGroup {
  return {
    kind: "setGroup",
    rowId: "group-1",
    productId: "sp1",
    productCode: "SET001",
    itemName: "セット商品",
    unit: "式",
    customerMemo: "",
    internalMemo: "",
    components: [line({ rowId: "comp-1", itemName: "構成明細" })],
    ...overrides,
  };
}

/** 各種ハンドラを no-op で埋めた最小 props で描画する（周辺追加ハンドラは任意）。 */
function renderTable(
  nodes: WorkingNode[],
  onRequestSuggestions?: (rowId: string, productId: string) => void | Promise<void>
) {
  return render(
    <LineEditTable
      nodes={nodes}
      activeRowId={null}
      onSelectRow={() => {}}
      onChangeLine={() => {}}
      onRemoveNode={() => {}}
      onReorderNodes={() => {}}
      onReorderComponents={() => {}}
      onRequestSuggestions={onRequestSuggestions}
    />
  );
}

describe("LineEditTable 単価乖離・解決不能バッジ（#593）", () => {
  it("乖離行に『単価乖離』バッジと現在値・符号つき差額ツールチップを出す", () => {
    renderTable([
      line({
        itemName: "乖離行",
        unitPriceDivergence: { kind: "DIVERGENT", currentUnitPrice: 1200, difference: 200 },
      }),
    ]);

    const badge = screen.getByText("単価乖離");
    expect(badge).toBeInTheDocument();
    const tooltip = badge.getAttribute("title") ?? "";
    expect(tooltip).toContain("1,200円");
    expect(tooltip).toContain("+200円");
  });

  it("解決不能行に『解決不能』バッジを出す", () => {
    renderTable([line({ itemName: "解決不能行", unitPriceDivergence: { kind: "UNRESOLVABLE" } })]);

    expect(screen.getByText("解決不能")).toBeInTheDocument();
  });

  it("乖離なし（NONE）・未合成の行にはバッジを出さない", () => {
    renderTable([
      line({ itemName: "一致行", unitPriceDivergence: { kind: "NONE" } }),
      line({ rowId: "row-2", itemName: "未合成行" }),
    ]);

    expect(screen.queryByText("単価乖離")).not.toBeInTheDocument();
    expect(screen.queryByText("解決不能")).not.toBeInTheDocument();
  });

  it("セット構成明細の乖離にもバッジを出す", () => {
    renderTable([
      setGroup({
        components: [
          line({
            rowId: "comp-1",
            itemName: "乖離構成",
            unitPriceDivergence: { kind: "DIVERGENT", currentUnitPrice: 1200, difference: 200 },
          }),
        ],
      }),
    ]);

    expect(screen.getByText("単価乖離")).toBeInTheDocument();
  });
});

describe("LineEditTable の HTML 構造（#369 hydration エラー修正）", () => {
  it("<table> の直接の子に <div> を持たない（DndContext を table 外へ出す）", () => {
    const { container } = renderTable([line()]);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    // DndContext のアクセシビリティ用 <div>（HiddenText）が table 直下に混入していないこと。
    expect(table?.querySelector(":scope > div")).toBeNull();
  });

  it("セット群（入れ子 SortableContext）を含んでも <table> 直下に <div> を持たない", () => {
    const { container } = renderTable([setGroup()]);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table?.querySelector(":scope > div")).toBeNull();
  });
});

describe("周辺追加ボタンの出し分け（#619）", () => {
  const noopRequest = () => {};

  it("周辺を持つトップレベル通常明細にボタンを出す", () => {
    renderTable([line({ itemName: "ポンプ", hasPeripheral: true })], noopRequest);

    expect(screen.getByLabelText("周辺商品を追加（ポンプ）")).toBeInTheDocument();
  });

  it("周辺を持たない行にはボタンを出さない", () => {
    renderTable([line({ itemName: "ポンプ", hasPeripheral: false })], noopRequest);

    expect(screen.queryByLabelText("周辺商品を追加（ポンプ）")).not.toBeInTheDocument();
  });

  it("セット構成明細（周辺ありでも）にはボタンを出さない", () => {
    renderTable(
      [
        setGroup({
          components: [line({ rowId: "comp-1", itemName: "構成ポンプ", hasPeripheral: true })],
        }),
      ],
      noopRequest
    );

    expect(screen.queryByLabelText("周辺商品を追加（構成ポンプ）")).not.toBeInTheDocument();
  });

  it("セット群ヘッダ行にはボタンを出さない", () => {
    renderTable([setGroup({ itemName: "セットA" })], noopRequest);

    expect(screen.queryByLabelText("周辺商品を追加（セットA）")).not.toBeInTheDocument();
  });

  it("onRequestSuggestions 未配線ならボタンを出さない", () => {
    renderTable([line({ itemName: "ポンプ", hasPeripheral: true })]);

    expect(screen.queryByLabelText("周辺商品を追加（ポンプ）")).not.toBeInTheDocument();
  });
});

describe("単価は読み取り専用（手入力不可・ADR-0064）", () => {
  it("単価セルは input ではなく表示で、数量は input のまま", () => {
    renderTable([line({ itemName: "ポンプ", unitPrice: 1000 })]);

    // 単価セルは <input> を持たない（read-only 表示）。数量は編集可能な input のまま。
    expect(screen.getByLabelText("単価（ポンプ）").tagName).not.toBe("INPUT");
    expect(screen.getByLabelText("数量（ポンプ）").tagName).toBe("INPUT");
  });
});
