import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { EstimateFactory, type VariationContent } from "@subdomains/estimate/domain/entities";
import { ItemName } from "@subdomains/estimate/domain/values/ItemName";
import { Money } from "@subdomains/estimate/domain/values/Money";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import { Unit } from "@subdomains/estimate/domain/values/Unit";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import type { ProductDTO } from "@subdomains/product/application/queries/dto/ProductDTO";
import type { ProductQueryService } from "@subdomains/product/application/queries/ProductQueryService";
import { describe, expect, it, vi } from "vitest";
import { assertSetComponentsValid } from "../assertSetComponentsValid";

const SET_PID = "00000000-0000-7000-8000-0000000000aa";
const COMP_A = "00000000-0000-7000-8000-0000000000b1";
const COMP_B = "00000000-0000-7000-8000-0000000000b2";
const NORMAL_PID = "00000000-0000-7000-8000-0000000000c1";

function product(id: string, category: string, isActive: boolean): ProductDTO {
  return {
    id,
    code: "CODE",
    name: "商品",
    category,
    unit: "個",
    isActive,
    description: null,
    note: null,
    costPrice: null,
    relatedProducts: [],
    setComponents: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function fakeQuery(products: ProductDTO[]): ProductQueryService {
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    findById: async (id: string) => byId.get(id) ?? null,
    findByIds: async (ids: string[]) =>
      ids.map((id) => byId.get(id)).filter((p): p is ProductDTO => p != null),
    findByCode: async () => null,
    findReferencingProducts: async () => [],
    search: async () => [],
  };
}

function compDescriptor(productId: string, sortOrder: number) {
  return {
    productId: new ProductId(productId),
    sortOrder,
    itemName: new ItemName("構成"),
    quantity: new Quantity(1),
    unit: new Unit("個"),
    unitPrice: Money.fromMajorUnits(1000),
  };
}

/** 構成 2 件のセット群＋通常明細 1 件の VariationContent を構築する。 */
function contentWithSetGroup(componentPids: string[]): VariationContent {
  return EstimateFactory.buildVariationContent({
    items: [
      {
        productId: new ProductId(NORMAL_PID),
        sortOrder: componentPids.length + 1,
        itemName: new ItemName("通常明細"),
        quantity: new Quantity(1),
        unit: new Unit("個"),
        unitPrice: Money.fromMajorUnits(500),
      },
    ],
    setGroups: [
      {
        productId: new ProductId(SET_PID),
        itemName: new ItemName("セット商品"),
        unit: new Unit("式"),
        components: componentPids.map((pid, idx) => compDescriptor(pid, idx + 1)),
      },
    ],
  });
}

describe("assertSetComponentsValid", () => {
  it("構成商品が個別/消耗品なら警告なしで通る", async () => {
    const content = contentWithSetGroup([COMP_A, COMP_B]);
    const query = fakeQuery([
      product(COMP_A, "INDIVIDUAL", true),
      product(COMP_B, "CONSUMABLE", true),
    ]);

    const warnings = await assertSetComponentsValid(content, query);

    expect(warnings).toEqual([]);
  });

  it("構成にセット商品が混じるとハードエラー（ペイロード防御）", async () => {
    const content = contentWithSetGroup([COMP_A]);
    const query = fakeQuery([product(COMP_A, "SET", true)]);

    await expect(assertSetComponentsValid(content, query)).rejects.toThrow(
      BusinessRuleViolationError
    );
  });

  it("無効構成は throw せず warning として返す", async () => {
    const content = contentWithSetGroup([COMP_A, COMP_B]);
    const query = fakeQuery([
      product(COMP_A, "INDIVIDUAL", true),
      product(COMP_B, "INDIVIDUAL", false),
    ]);

    const warnings = await assertSetComponentsValid(content, query);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].productId).toBe(COMP_B);
  });

  it("セット群が無ければ商品クエリを呼ばずに空を返す", async () => {
    const content = EstimateFactory.buildVariationContent({
      items: [
        {
          productId: new ProductId(NORMAL_PID),
          sortOrder: 1,
          itemName: new ItemName("通常"),
          quantity: new Quantity(1),
          unit: new Unit("個"),
          unitPrice: Money.fromMajorUnits(500),
        },
      ],
    });
    const query = fakeQuery([]);
    const spy = vi.spyOn(query, "findByIds");

    const warnings = await assertSetComponentsValid(content, query);

    expect(warnings).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("構成商品のみを検証対象とし、群本体（SET 区分）は許可区分検証にかけない", async () => {
    const content = contentWithSetGroup([COMP_A]);
    // 群本体 SET_PID は INDIVIDUAL でない（SET）が、構成だけが検証対象なのでエラーにならない
    const query = fakeQuery([product(COMP_A, "INDIVIDUAL", true), product(SET_PID, "SET", true)]);

    await expect(assertSetComponentsValid(content, query)).resolves.toEqual([]);
  });
});
