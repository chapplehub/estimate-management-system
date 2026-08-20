import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { describe, expect, it } from "vitest";
import { EstimateItemId } from "../../values/EstimateItemId";
import { ItemName } from "../../values/ItemName";
import { Unit } from "../../values/Unit";
import { EstimateSetGroup } from "../EstimateSetGroup";

describe("EstimateSetGroup", () => {
  it("構成明細 id を順序付きで保持して生成できる", () => {
    const m1 = EstimateItemId.generate();
    const m2 = EstimateItemId.generate();
    const group = EstimateSetGroup.create({
      productId: ProductId.generate(),
      itemName: new ItemName("セット商品A"),
      unit: new Unit("式"),
      memberItemIds: [m1, m2],
    });

    expect(group.id).toBeDefined();
    expect(group.memberItemIds.map((id) => id.value)).toEqual([m1.value, m2.value]);
    expect(group.itemName.value).toBe("セット商品A");
  });

  it("構成明細が空のセット群は作成できない（空群禁止）", () => {
    expect(() =>
      EstimateSetGroup.create({
        productId: ProductId.generate(),
        itemName: new ItemName("セット商品A"),
        unit: new Unit("式"),
        memberItemIds: [],
      })
    ).toThrow("空群禁止");
  });
});
