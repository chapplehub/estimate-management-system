import { describe, expect, it } from "vitest";
import {
  toVariationContentInput,
  toVariationContentInputFromNodes,
} from "./variationContentMapping";
import type { VariationLineInput, VariationNodeInput } from "./variationSchema";

function line(overrides: Partial<VariationLineInput> = {}): VariationLineInput {
  return {
    productId: "prod-1",
    itemName: "商品A",
    unit: "個",
    quantity: 1,
    unitPrice: 1000,
    discountRate: 1.0,
    itemDiscount: 0,
    customerMemo: "",
    internalMemo: "",
    ...overrides,
  };
}

describe("toVariationContentInput（検証済フォーム値 → C4 入力への写像）", () => {
  it("sortOrder を配列順から 1..N で導出する（ADR-0050）", () => {
    const result = toVariationContentInput({
      lines: [line({ productId: "p1" }), line({ productId: "p2" }), line({ productId: "p3" })],
      overallDiscount: 0,
      customerMemo: "",
      internalMemo: "",
    });

    expect(result.items.map((i) => ({ productId: i.productId, sortOrder: i.sortOrder }))).toEqual([
      { productId: "p1", sortOrder: 1 },
      { productId: "p2", sortOrder: 2 },
      { productId: "p3", sortOrder: 3 },
    ]);
  });

  it("明細の各項目を C4 入力へ通す", () => {
    const result = toVariationContentInput({
      lines: [
        line({
          productId: "p1",
          itemName: "ねじ",
          unit: "本",
          quantity: 5,
          unitPrice: 80,
          discountRate: 0.9,
          itemDiscount: 50,
          customerMemo: "顧客M",
          internalMemo: "社内M",
        }),
      ],
      overallDiscount: 0,
      customerMemo: "",
      internalMemo: "",
    });

    expect(result.items[0]).toEqual({
      productId: "p1",
      sortOrder: 1,
      itemName: "ねじ",
      unit: "本",
      quantity: 5,
      unitPrice: 80,
      discountRate: 0.9,
      itemDiscount: 50,
      customerMemo: "顧客M",
      internalMemo: "社内M",
    });
  });

  it("全体値引・バリメモを通す", () => {
    const result = toVariationContentInput({
      lines: [],
      overallDiscount: 300,
      customerMemo: "バリ顧客メモ",
      internalMemo: "バリ社内メモ",
    });

    expect(result.overallDiscount).toBe(300);
    expect(result.customerMemo).toBe("バリ顧客メモ");
    expect(result.internalMemo).toBe("バリ社内メモ");
  });

  it("明細ゼロは空の items を返す（ドメインが空配列を許容・§5）", () => {
    const result = toVariationContentInput({
      lines: [],
      overallDiscount: 0,
      customerMemo: "",
      internalMemo: "",
    });

    expect(result.items).toEqual([]);
  });
});

describe("toVariationContentInputFromNodes（ノード union → C4/C1 入力）", () => {
  function lineNode(productId: string): VariationNodeInput {
    return {
      kind: "line",
      productId,
      itemName: "通常",
      unit: "個",
      quantity: 1,
      unitPrice: 1000,
      discountRate: 1.0,
      itemDiscount: 0,
      customerMemo: "",
      internalMemo: "",
    };
  }

  function setGroupNode(productId: string, componentPids: string[]): VariationNodeInput {
    return {
      kind: "setGroup",
      productId,
      itemName: "セット商品",
      unit: "式",
      components: componentPids.map((pid) => ({
        productId: pid,
        itemName: "構成",
        unit: "個",
        quantity: 1,
        unitPrice: 0,
        discountRate: 1.0,
        itemDiscount: 0,
        customerMemo: "",
        internalMemo: "",
      })),
    };
  }

  it("通常明細とセット群を items / setGroups に振り分ける", () => {
    const result = toVariationContentInputFromNodes({
      nodes: [lineNode("n1"), setGroupNode("set-1", ["c1", "c2"])],
      overallDiscount: 0,
    });

    expect(result.items.map((i) => i.productId)).toEqual(["n1"]);
    expect(result.setGroups).toHaveLength(1);
    expect(result.setGroups![0].productId).toBe("set-1");
    expect(result.setGroups![0].components.map((c) => c.productId)).toEqual(["c1", "c2"]);
  });

  it("sortOrder は通常・構成を出現順で連番（配列順 = 真実・ADR-0050）", () => {
    // [通常 n1, 群(c1,c2), 通常 n2] → n1=1, c1=2, c2=3, n2=4
    const result = toVariationContentInputFromNodes({
      nodes: [lineNode("n1"), setGroupNode("set-1", ["c1", "c2"]), lineNode("n2")],
      overallDiscount: 0,
    });

    expect(result.items.find((i) => i.productId === "n1")!.sortOrder).toBe(1);
    expect(result.setGroups![0].components.map((c) => c.sortOrder)).toEqual([2, 3]);
    expect(result.items.find((i) => i.productId === "n2")!.sortOrder).toBe(4);
  });

  it("全体値引・バリメモを通す", () => {
    const result = toVariationContentInputFromNodes({
      nodes: [],
      overallDiscount: 500,
      customerMemo: "顧客M",
      internalMemo: "社内M",
    });

    expect(result.overallDiscount).toBe(500);
    expect(result.customerMemo).toBe("顧客M");
    expect(result.internalMemo).toBe("社内M");
    expect(result.items).toEqual([]);
    expect(result.setGroups).toEqual([]);
  });
});
