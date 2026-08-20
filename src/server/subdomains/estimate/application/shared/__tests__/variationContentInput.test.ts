import { Money } from "@server/shared/domain/values/Money";
import { describe, expect, it } from "vitest";
import {
  toVariationContentDescriptor,
  type EstimateItemInput,
  type LinePriceMap,
  type VariationContentInput,
} from "../variationContentInput";

const PID = "00000000-0000-7000-8000-000000000001";
const SET_PID = "00000000-0000-7000-8000-0000000000aa";
const COMP_PID = "00000000-0000-7000-8000-0000000000bb";

/** 明細入力オブジェクト参照 → 円単価の priceMap を組み立てる（価格決定の解決結果を模す）。 */
function priceMapOf(entries: Array<[EstimateItemInput, number]>): LinePriceMap {
  return new Map(entries.map(([item, yen]) => [item, Money.fromMajorUnits(yen)]));
}

describe("toVariationContentDescriptor", () => {
  it("通常明細を items 記述子へ写し、単価は priceMap から引く", () => {
    const item: EstimateItemInput = {
      productId: PID,
      sortOrder: 1,
      itemName: "通常明細",
      quantity: 1,
      unit: "個",
    };
    const input: VariationContentInput = { items: [item] };

    const desc = toVariationContentDescriptor(input, priceMapOf([[item, 1000]]));

    expect(desc.items).toHaveLength(1);
    expect(desc.items[0].itemName.value).toBe("通常明細");
    // 単価は入力に無く priceMap の解決値が入る（ADR-0064）。
    expect(desc.items[0].unitPrice.majorUnits).toBe(1000);
  });

  it("セット群を setGroups 記述子へ写し、構成を入れ子で持つ", () => {
    const component: EstimateItemInput = {
      productId: COMP_PID,
      sortOrder: 1,
      itemName: "構成1",
      quantity: 2,
      unit: "個",
    };
    const input: VariationContentInput = {
      items: [],
      setGroups: [
        {
          productId: SET_PID,
          itemName: "セット商品",
          unit: "式",
          components: [component],
        },
      ],
    };

    const desc = toVariationContentDescriptor(input, priceMapOf([[component, 500]]));

    expect(desc.setGroups).toHaveLength(1);
    expect(desc.setGroups![0].itemName.value).toBe("セット商品");
    expect(desc.setGroups![0].unit.value).toBe("式");
    expect(desc.setGroups![0].components).toHaveLength(1);
    expect(desc.setGroups![0].components[0].unitPrice.majorUnits).toBe(500);
    expect(desc.setGroups![0].components[0].productId.value).toBe(COMP_PID);
  });

  it("setGroups 省略時は空（既存の通常明細のみ往復は壊さない）", () => {
    const item: EstimateItemInput = {
      productId: PID,
      sortOrder: 1,
      itemName: "通常",
      quantity: 1,
      unit: "個",
    };

    const desc = toVariationContentDescriptor({ items: [item] }, priceMapOf([[item, 1000]]));

    expect(desc.setGroups ?? []).toHaveLength(0);
  });

  it("priceMap に無い明細は内部エラー（解決漏れの検出）", () => {
    const item: EstimateItemInput = {
      productId: PID,
      sortOrder: 1,
      itemName: "未解決",
      quantity: 1,
      unit: "個",
    };

    expect(() => toVariationContentDescriptor({ items: [item] }, new Map())).toThrow(
      "明細の見積単価が解決されていません（内部エラー）"
    );
  });
});
