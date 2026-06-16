import { describe, expect, it } from "vitest";
import { toVariationContentDescriptor, type VariationContentInput } from "../variationContentInput";

const PID = "00000000-0000-7000-8000-000000000001";
const SET_PID = "00000000-0000-7000-8000-0000000000aa";
const COMP_PID = "00000000-0000-7000-8000-0000000000bb";

describe("toVariationContentDescriptor", () => {
  it("通常明細を items 記述子へ写す", () => {
    const input: VariationContentInput = {
      items: [
        {
          productId: PID,
          sortOrder: 1,
          itemName: "通常明細",
          quantity: 1,
          unit: "個",
          unitPrice: 1000,
        },
      ],
    };

    const desc = toVariationContentDescriptor(input);

    expect(desc.items).toHaveLength(1);
    expect(desc.items[0].itemName.value).toBe("通常明細");
  });

  it("セット群を setGroups 記述子へ写し、構成を入れ子で持つ", () => {
    const input: VariationContentInput = {
      items: [],
      setGroups: [
        {
          productId: SET_PID,
          itemName: "セット商品",
          unit: "式",
          components: [
            {
              productId: COMP_PID,
              sortOrder: 1,
              itemName: "構成1",
              quantity: 2,
              unit: "個",
              unitPrice: 500,
            },
          ],
        },
      ],
    };

    const desc = toVariationContentDescriptor(input);

    expect(desc.setGroups).toHaveLength(1);
    expect(desc.setGroups![0].itemName.value).toBe("セット商品");
    expect(desc.setGroups![0].unit.value).toBe("式");
    expect(desc.setGroups![0].components).toHaveLength(1);
    expect(desc.setGroups![0].components[0].unitPrice.majorUnits).toBe(500);
    expect(desc.setGroups![0].components[0].productId.value).toBe(COMP_PID);
  });

  it("setGroups 省略時は空（既存の通常明細のみ往復は壊さない）", () => {
    const desc = toVariationContentDescriptor({
      items: [
        {
          productId: PID,
          sortOrder: 1,
          itemName: "通常",
          quantity: 1,
          unit: "個",
          unitPrice: 1000,
        },
      ],
    });

    expect(desc.setGroups ?? []).toHaveLength(0);
  });
});
