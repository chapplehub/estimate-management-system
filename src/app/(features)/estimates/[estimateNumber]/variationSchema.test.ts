import { describe, expect, it } from "vitest";
import { updateVariationContentSchema } from "./variationSchema";

/** FormData 相当（スカラーは文字列、lines は JSON 文字列）の正常入力を組み立てる。 */
function validFormLike(overrides: Record<string, unknown> = {}) {
  return {
    version: "3",
    variationId: "var-1",
    overallDiscount: "0",
    customerMemo: "",
    internalMemo: "",
    lines: JSON.stringify([
      {
        productId: "prod-1",
        itemName: "商品A",
        unit: "個",
        quantity: 2,
        unitPrice: 1000,
        discountRate: 1.0,
        itemDiscount: 0,
        customerMemo: "",
        internalMemo: "",
      },
    ]),
    ...overrides,
  };
}

describe("updateVariationContentSchema（バリ内容編集・ADR-0050）", () => {
  it("正常な JSON 明細配列を型付きの値へ解釈する", () => {
    const result = updateVariationContentSchema.safeParse(validFormLike());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(3);
      expect(result.data.variationId).toBe("var-1");
      expect(result.data.lines).toHaveLength(1);
      expect(result.data.lines[0]).toMatchObject({
        productId: "prod-1",
        itemName: "商品A",
        unit: "個",
        quantity: 2,
        unitPrice: 1000,
        discountRate: 1,
        itemDiscount: 0,
      });
    }
  });

  it("壊れた JSON はフォームエラーになる（明細フィールドに集約）", () => {
    const result = updateVariationContentSchema.safeParse(validFormLike({ lines: "{壊れ" }));

    expect(result.success).toBe(false);
    if (!result.success) {
      const linesIssue = result.error.issues.find((i) => i.path[0] === "lines");
      expect(linesIssue?.message).toBe("明細データが不正です");
    }
  });

  it("明細ゼロ（空配列）の保存を許可する（ドメインが空配列を許容・§5）", () => {
    const result = updateVariationContentSchema.safeParse(validFormLike({ lines: "[]" }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines).toEqual([]);
    }
  });

  it("数量0 などドメイン制約違反の明細は弾く（VO と整合の二重防御）", () => {
    const lines = JSON.stringify([
      {
        productId: "prod-1",
        itemName: "商品A",
        unit: "個",
        quantity: 0,
        unitPrice: 1000,
        discountRate: 1.0,
        itemDiscount: 0,
        customerMemo: "",
        internalMemo: "",
      },
    ]);
    const result = updateVariationContentSchema.safeParse(validFormLike({ lines }));

    expect(result.success).toBe(false);
  });
});
