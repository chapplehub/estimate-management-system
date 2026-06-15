import { describe, expect, it } from "vitest";
import { toVariationContentInput } from "./variationContentMapping";
import type { VariationLineInput } from "./variationSchema";

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
