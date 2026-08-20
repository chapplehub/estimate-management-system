import type { ProductDTO } from "@subdomains/product/application/queries/dto/ProductDTO";
import { describe, expect, it } from "vitest";
import { toExpandedSetGroup } from "./setComponentExpansion";

function product(overrides: Partial<ProductDTO> = {}): ProductDTO {
  return {
    id: "set-1",
    code: "SET001",
    name: "セット商品",
    category: "SET",
    unit: "式",
    isActive: true,
    description: null,
    note: null,
    relatedProducts: [],
    setComponents: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("toExpandedSetGroup", () => {
  it("SET 商品の構成を展開し、単位・有効性は解決商品から、数量は構成定義から取る", () => {
    const setProduct = product({
      setComponents: [
        {
          componentProductId: "c1",
          componentProductCode: "C001",
          componentProductName: "構成1",
          componentProductCategory: "INDIVIDUAL",
          quantity: 3,
        },
      ],
    });
    const resolved = new Map<string, ProductDTO>([
      ["c1", product({ id: "c1", category: "INDIVIDUAL", unit: "個", isActive: true })],
    ]);

    const group = toExpandedSetGroup(setProduct, (id) => resolved.get(id) ?? null);

    expect(group).not.toBeNull();
    expect(group!.productId).toBe("set-1");
    expect(group!.unit).toBe("式");
    expect(group!.components).toHaveLength(1);
    const c = group!.components[0];
    expect(c.productId).toBe("c1");
    expect(c.name).toBe("構成1");
    expect(c.unit).toBe("個");
    expect(c.quantity).toBe(3);
    expect(c.isActive).toBe(true);
  });

  it("SET 以外の商品では null を返す", () => {
    const notSet = product({ category: "INDIVIDUAL" });

    expect(toExpandedSetGroup(notSet, () => null)).toBeNull();
  });

  it("無効な構成商品も捨てず isActive=false で含める（周辺サジェストと非対称）", () => {
    const setProduct = product({
      setComponents: [
        {
          componentProductId: "c-inactive",
          componentProductCode: "C002",
          componentProductName: "無効構成",
          componentProductCategory: "INDIVIDUAL",
          quantity: 1,
        },
      ],
    });
    const resolved = new Map<string, ProductDTO>([
      ["c-inactive", product({ id: "c-inactive", unit: "個", isActive: false })],
    ]);

    const group = toExpandedSetGroup(setProduct, (id) => resolved.get(id) ?? null);

    expect(group!.components).toHaveLength(1);
    expect(group!.components[0].isActive).toBe(false);
  });

  it("解決できない構成商品はフォールバック（unit 空・isActive=false）しつつ含める", () => {
    const setProduct = product({
      setComponents: [
        {
          componentProductId: "missing",
          componentProductCode: "C003",
          componentProductName: "欠落構成",
          componentProductCategory: "CONSUMABLE",
          quantity: 2,
        },
      ],
    });

    const group = toExpandedSetGroup(setProduct, () => null);

    expect(group!.components).toHaveLength(1);
    expect(group!.components[0].unit).toBe("");
    expect(group!.components[0].isActive).toBe(false);
    // 構成定義の値（code/name/category/quantity）はフォールバックでも保持する
    expect(group!.components[0].name).toBe("欠落構成");
    expect(group!.components[0].quantity).toBe(2);
  });
});
