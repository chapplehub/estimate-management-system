import { describe, expect, it } from "vitest";
import { addVariationNodeSchema, updateVariationContentNodeSchema } from "./variationSchema";

describe("updateVariationContentNodeSchema（セット群対応・判別子 union・S5）", () => {
  const lineNode = {
    kind: "line",
    productId: "p1",
    itemName: "通常",
    unit: "個",
    quantity: 1,
    unitPrice: 1000,
    discountRate: 1.0,
    itemDiscount: 0,
  };

  const setGroupNode = {
    kind: "setGroup",
    productId: "set-1",
    itemName: "セット商品",
    unit: "式",
    components: [
      {
        productId: "c1",
        itemName: "構成1",
        unit: "個",
        quantity: 1,
        unitPrice: 0,
        discountRate: 1.0,
        itemDiscount: 0,
      },
    ],
  };

  function parseNodes(nodes: unknown) {
    return updateVariationContentNodeSchema.safeParse({
      version: "1",
      variationId: "v1",
      overallDiscount: "0",
      nodes: JSON.stringify(nodes),
    });
  }

  it("通常明細ノードとセット群ノードの混在を通す", () => {
    expect(parseNodes([lineNode, setGroupNode]).success).toBe(true);
  });

  it("構成明細が空のセット群を拒否する（空群禁止の第一防御・min(1)）", () => {
    expect(parseNodes([{ ...setGroupNode, components: [] }]).success).toBe(false);
  });

  it("商品未選択（productId 空）の通常明細を拒否する", () => {
    expect(parseNodes([{ ...lineNode, productId: "" }]).success).toBe(false);
  });

  it("空のノード配列は許可する（明細ゼロ・§5）", () => {
    expect(parseNodes([]).success).toBe(true);
  });

  it("壊れた JSON はフォームエラーになる（明細フィールドに集約）", () => {
    const result = updateVariationContentNodeSchema.safeParse({
      version: "1",
      variationId: "v1",
      overallDiscount: "0",
      nodes: "{壊れ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "nodes");
      expect(issue?.message).toBe("明細データが不正です");
    }
  });

  it("数量0 などドメイン制約違反の明細は弾く（VO と整合の二重防御）", () => {
    expect(parseNodes([{ ...lineNode, quantity: 0 }]).success).toBe(false);
  });
});

describe("addVariationNodeSchema（作成・提出区分付き・C3）", () => {
  function parseCreate(overrides: Record<string, unknown> = {}) {
    return addVariationNodeSchema.safeParse({
      version: "1",
      submissionType: "CUSTOMER",
      overallDiscount: "0",
      nodes: JSON.stringify([]),
      ...overrides,
    });
  }

  it("提出区分付きの有効な作成入力を通す（tracer bullet）", () => {
    expect(parseCreate().success).toBe(true);
  });

  it("納品先向けの提出区分も通す", () => {
    expect(parseCreate({ submissionType: "DELIVERY_LOCATION" }).success).toBe(true);
  });

  it("列挙外の提出区分を拒否する（CUSTOMER/DELIVERY_LOCATION のみ・ADR-0045）", () => {
    expect(parseCreate({ submissionType: "FOO" }).success).toBe(false);
  });

  it("提出区分なしを拒否する（作成時に必ず選ぶ・回帰ガード）", () => {
    expect(parseCreate({ submissionType: undefined }).success).toBe(false);
  });
});
