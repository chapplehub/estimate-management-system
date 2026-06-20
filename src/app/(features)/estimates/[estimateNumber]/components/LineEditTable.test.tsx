import { render } from "@testing-library/react";
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

/** 各種ハンドラを no-op で埋めた最小 props で描画する。 */
function renderTable(nodes: WorkingNode[]) {
  return render(
    <LineEditTable
      nodes={nodes}
      activeRowId={null}
      onSelectRow={() => {}}
      onChangeLine={() => {}}
      onRemoveNode={() => {}}
      onReorderNodes={() => {}}
      onReorderComponents={() => {}}
    />
  );
}

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
