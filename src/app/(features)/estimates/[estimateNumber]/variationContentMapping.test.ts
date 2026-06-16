import { describe, expect, it } from "vitest";
import { toVariationContentInputFromNodes } from "./variationContentMapping";
import type { VariationNodeInput } from "./variationSchema";

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
