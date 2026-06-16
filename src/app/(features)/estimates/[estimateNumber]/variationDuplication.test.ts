import { describe, expect, it } from "vitest";
import type {
  LineDTO,
  SetGroupDTO,
  VariationDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { toCreateInitialValuesFromVariation } from "./variationDuplication";

/** テスト用 LineDTO ビルダ（複製元の通常明細）。 */
function line(overrides: Partial<LineDTO> = {}): LineDTO {
  return {
    kind: "line",
    itemId: "item-1",
    productId: "p1",
    productCode: "P001",
    productCategory: "GENERAL",
    isActive: true,
    itemName: "通常明細",
    sortOrder: 1,
    quantity: 2,
    unit: "個",
    unitPrice: 1000,
    discountRate: 1.0,
    itemDiscount: 0,
    baseAmount: 2000,
    finalAmount: 2000,
    customerMemo: "",
    internalMemo: "",
    revisedDeliveryPrice: null,
    ...overrides,
  };
}

/** テスト用 SetGroupDTO ビルダ（複製元のセット群）。 */
function setGroup(overrides: Partial<SetGroupDTO> = {}): SetGroupDTO {
  return {
    kind: "setGroup",
    setGroupId: "sg-1",
    productId: "set-1",
    productCode: "SET001",
    productCategory: "SET",
    itemName: "セット商品",
    unit: "式",
    customerMemo: "",
    internalMemo: "",
    amount: 0,
    sortOrder: 1,
    components: [line({ itemId: "c1", productId: "c1", itemName: "構成1" })],
    ...overrides,
  };
}

/** テスト用 VariationDTO ビルダ（複製元バリエーション）。 */
function variation(overrides: Partial<VariationDTO> = {}): VariationDTO {
  return {
    variationId: "v1",
    variationNumber: 1,
    status: "ACTIVE",
    submissionType: "CUSTOMER",
    overallDiscount: 0,
    customerMemo: "",
    internalMemo: "",
    subtotal: 0,
    discountSubtotal: 0,
    finalSubtotal: 0,
    taxAmount: 0,
    finalTotal: 0,
    lines: [line()],
    ...overrides,
  };
}

describe("toCreateInitialValuesFromVariation（複製元 → 作成フォーム初期値・C3）", () => {
  it("複製元の提出区分を初期値に引き継ぐ（tracer bullet）", () => {
    const result = toCreateInitialValuesFromVariation(
      variation({ submissionType: "DELIVERY_LOCATION" })
    );
    expect(result.submissionType).toBe("DELIVERY_LOCATION");
  });

  it("セット群を含む複製元は構成明細スナップショットごと初期 nodes に保たれる", () => {
    const result = toCreateInitialValuesFromVariation(variation({ lines: [setGroup()] }));

    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0];
    expect(node.kind).toBe("setGroup");
    if (node.kind === "setGroup") {
      expect(node.components).toHaveLength(1);
      expect(node.components[0].itemName).toBe("構成1");
    }
  });

  it("全体値引・顧客メモ・社内メモを初期値に引き継ぐ", () => {
    const result = toCreateInitialValuesFromVariation(
      variation({ overallDiscount: 500, customerMemo: "得意先メモ", internalMemo: "社内メモ" })
    );

    expect(result.overallDiscount).toBe(500);
    expect(result.customerMemo).toBe("得意先メモ");
    expect(result.internalMemo).toBe("社内メモ");
  });
});
