import type {
  LineDTO,
  SetGroupDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { describe, expect, it } from "vitest";
import type { ExpandedSetGroup } from "../_shared/setComponentExpansion";
import {
  changeNodeLine,
  createWorkingLine,
  createWorkingSetGroup,
  fromSetGroupDTO,
  fromVariationLines,
  insertNodesBelow,
  removeNode,
  reorderComponents,
  reorderNodes,
  toNodePayload,
  type WorkingNode,
  type WorkingSetGroup,
} from "./variationLines";

function lineDTO(overrides: Partial<LineDTO> = {}): LineDTO {
  return {
    kind: "line",
    itemId: "item-1",
    productId: "prod-1",
    productCode: "P001",
    productCategory: "INDIVIDUAL",
    isActive: true,
    itemName: "商品",
    sortOrder: 1,
    quantity: 1,
    unit: "個",
    unitPrice: 1000,
    discountRate: 1.0,
    itemDiscount: 0,
    baseAmount: 1000,
    finalAmount: 1000,
    customerMemo: "",
    internalMemo: "",
    revisedDeliveryPrice: null,
    ...overrides,
  };
}

function setGroupDTO(overrides: Partial<SetGroupDTO> = {}): SetGroupDTO {
  return {
    kind: "setGroup",
    setGroupId: "sg-1",
    productId: "set-1",
    productCode: "SET001",
    productCategory: "SET",
    itemName: "セット商品",
    unit: "式",
    customerMemo: "",
    internalMemo: "",
    amount: 1500,
    sortOrder: 1,
    components: [
      lineDTO({ itemId: "c1", itemName: "構成1", sortOrder: 1, finalAmount: 1000 }),
      lineDTO({ itemId: "c2", itemName: "構成2", sortOrder: 2, finalAmount: 500 }),
    ],
    ...overrides,
  };
}

const lineProduct = { id: "p", code: "P", name: "商品", category: "INDIVIDUAL", unit: "個" };

/** トップレベル通常明細ノード（rowId 指定）。 */
function line(rowId: string): WorkingNode {
  return createWorkingLine(rowId, { ...lineProduct, id: rowId });
}

/** components を rowId 配列で持つセット群ノード。 */
function group(rowId: string, componentRowIds: string[]): WorkingSetGroup {
  return {
    kind: "setGroup",
    rowId,
    productId: "set-1",
    productCode: "SET001",
    itemName: "セット商品",
    unit: "式",
    customerMemo: "",
    internalMemo: "",
    components: componentRowIds.map((id) => createWorkingLine(id, { ...lineProduct, id })),
  };
}

describe("fromSetGroupDTO / fromVariationLines（read DTO → 作業ノード）", () => {
  it("セット群 DTO を群ノードへ写し、構成を入れ子で持つ", () => {
    const node = fromSetGroupDTO(setGroupDTO());

    expect(node.kind).toBe("setGroup");
    expect(node.rowId).toBe("sg-1");
    expect(node.components.map((c) => c.rowId)).toEqual(["c1", "c2"]);
    expect(node.components[0].kind).toBe("line");
  });

  it("行配列（LineDTO | SetGroupDTO）を判別子でノードへ振り分ける", () => {
    const nodes = fromVariationLines([setGroupDTO(), lineDTO({ itemId: "n1", kind: "line" })]);

    expect(nodes.map((n) => n.kind)).toEqual(["setGroup", "line"]);
    expect(nodes[1].rowId).toBe("n1");
  });
});

describe("createWorkingSetGroup（自動展開結果 → 作業ノード）", () => {
  const expanded: ExpandedSetGroup = {
    productId: "set-9",
    code: "SET009",
    name: "新セット",
    unit: "式",
    components: [
      {
        productId: "ca",
        code: "CA",
        name: "構成A",
        category: "INDIVIDUAL",
        unit: "個",
        quantity: 3,
        isActive: true,
      },
      {
        productId: "cb",
        code: "CB",
        name: "構成B",
        category: "CONSUMABLE",
        unit: "本",
        quantity: 1,
        isActive: false,
      },
    ],
  };

  it("構成は単価0・数量=構成定義・有効性スナップショットで作られる", () => {
    const node = createWorkingSetGroup("g-row", expanded, (i) => `c-row-${i}`);

    expect(node.rowId).toBe("g-row");
    expect(node.productId).toBe("set-9");
    expect(node.components).toHaveLength(2);
    expect(node.components[0]).toMatchObject({
      rowId: "c-row-0",
      productId: "ca",
      quantity: 3,
      unitPrice: 0,
      isActive: true,
    });
    // 無効構成も捨てず isActive=false で含める
    expect(node.components[1]).toMatchObject({ rowId: "c-row-1", isActive: false });
  });
});

describe("insertNodesBelow（トップレベル挿入・構成の連続配置を保つ）", () => {
  it("アクティブがトップレベル明細なら直下へ挿入", () => {
    const nodes = [line("A"), line("B"), line("C")];
    const result = insertNodesBelow(nodes, "B", [line("X")]);
    expect(result.map((n) => n.rowId)).toEqual(["A", "B", "X", "C"]);
  });

  it("アクティブが構成明細なら、それを含む群の直後（トップレベル）へ挿入", () => {
    const nodes = [line("A"), group("G", ["c1", "c2"]), line("Z")];
    // アクティブ = 構成 c1 → 群 G の直後へ
    const result = insertNodesBelow(nodes, "c1", [line("X")]);
    expect(result.map((n) => n.rowId)).toEqual(["A", "G", "X", "Z"]);
  });

  it("アクティブが null なら末尾へ", () => {
    const nodes = [line("A")];
    const result = insertNodesBelow(nodes, null, [line("X")]);
    expect(result.map((n) => n.rowId)).toEqual(["A", "X"]);
  });
});

describe("removeNode（群カスケード／最後の構成削除で群自動削除）", () => {
  it("トップレベル明細を除去する", () => {
    const nodes = [line("A"), line("B")];
    expect(removeNode(nodes, "A").map((n) => n.rowId)).toEqual(["B"]);
  });

  it("セット群を除去すると構成ごとカスケード削除される", () => {
    const nodes = [line("A"), group("G", ["c1", "c2"])];
    const result = removeNode(nodes, "G");
    expect(result.map((n) => n.rowId)).toEqual(["A"]);
  });

  it("構成明細を1件除去しても群は残る（複数構成）", () => {
    const nodes = [group("G", ["c1", "c2"])];
    const result = removeNode(nodes, "c1") as WorkingSetGroup[];
    expect(result).toHaveLength(1);
    expect(result[0].components.map((c) => c.rowId)).toEqual(["c2"]);
  });

  it("最後の構成明細を除去すると群ごと自動削除される（空群禁止）", () => {
    const nodes = [line("A"), group("G", ["only"])];
    const result = removeNode(nodes, "only");
    expect(result.map((n) => n.rowId)).toEqual(["A"]);
  });
});

describe("changeNodeLine（通常・構成どちらも更新）", () => {
  it("トップレベル明細を更新する", () => {
    const nodes = [line("A")];
    const result = changeNodeLine(nodes, "A", { quantity: 9 });
    expect((result[0] as { quantity: number }).quantity).toBe(9);
  });

  it("構成明細を群内で更新する", () => {
    const nodes = [group("G", ["c1", "c2"])];
    const result = changeNodeLine(nodes, "c2", { unitPrice: 777 }) as WorkingSetGroup[];
    expect(result[0].components[1].unitPrice).toBe(777);
    expect(result[0].components[0].unitPrice).toBe(0);
  });
});

describe("set-aware reorder", () => {
  it("reorderNodes はトップレベルを並べ替える", () => {
    const nodes = [line("A"), group("G", ["c1"]), line("B")];
    const result = reorderNodes(nodes, 0, 2);
    expect(result.map((n) => n.rowId)).toEqual(["G", "B", "A"]);
  });

  it("reorderComponents は指定群の構成のみ並べ替える", () => {
    const nodes = [group("G", ["c1", "c2", "c3"])];
    const result = reorderComponents(nodes, "G", 0, 2) as WorkingSetGroup[];
    expect(result[0].components.map((c) => c.rowId)).toEqual(["c2", "c3", "c1"]);
  });
});

describe("toNodePayload（JSON 往復用に schema 項目へ絞る）", () => {
  it("通常明細ノードは kind=line ＋ line 項目に絞る", () => {
    const payload = toNodePayload([line("A")]);
    expect(payload[0]).toMatchObject({ kind: "line", productId: "A" });
    expect(payload[0]).not.toHaveProperty("rowId");
    expect(payload[0]).not.toHaveProperty("isActive");
  });

  it("セット群ノードは kind=setGroup ＋ 構成を入れ子で絞る", () => {
    const payload = toNodePayload([group("G", ["c1", "c2"])]);
    const node = payload[0];
    expect(node.kind).toBe("setGroup");
    if (node.kind !== "setGroup") return;
    expect(node.productId).toBe("set-1");
    expect(node.components).toHaveLength(2);
    expect(node.components[0]).not.toHaveProperty("rowId");
    expect(node).not.toHaveProperty("rowId");
  });
});
