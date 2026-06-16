import { describe, expect, it } from "vitest";
import type {
  LineDTO,
  SetGroupDTO,
  VariationDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { isVariationEditable } from "./variationEditable";

/** テスト用の最小 LineDTO（必要なフィールドのみ上書き）。 */
function line(overrides: Partial<LineDTO> = {}): LineDTO {
  return {
    kind: "line",
    itemId: "item-1",
    productId: "prod-1",
    productCode: "PRD001",
    productCategory: "INDIVIDUAL",
    isActive: true,
    itemName: "明細",
    sortOrder: 0,
    quantity: 1,
    unit: "個",
    unitPrice: 1000,
    discountRate: 0,
    itemDiscount: 0,
    baseAmount: 1000,
    finalAmount: 1000,
    customerMemo: "",
    internalMemo: "",
    revisedDeliveryPrice: null,
    ...overrides,
  };
}

/** テスト用の最小 SetGroupDTO。 */
function setGroup(components: LineDTO[]): SetGroupDTO {
  return {
    kind: "setGroup",
    setGroupId: "sg-1",
    productId: "prod-set",
    productCode: "PRD100",
    productCategory: "SET",
    itemName: "セット一式",
    unit: "式",
    customerMemo: "",
    internalMemo: "",
    amount: components.reduce((s, c) => s + c.finalAmount, 0),
    sortOrder: 0,
    components,
  };
}

function variation(overrides: Partial<VariationDTO> = {}): VariationDTO {
  return {
    variationId: "v-1",
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

describe("isVariationEditable", () => {
  it("通常明細のみの ACTIVE バリは編集可能", () => {
    expect(isVariationEditable(variation({ lines: [line()] }))).toBe(true);
  });

  it("セット群を含む ACTIVE バリも編集可能（S5・C4 がセット書き込みに対応）", () => {
    const v = variation({ lines: [setGroup([line(), line()]), line()] });
    expect(isVariationEditable(v)).toBe(true);
  });

  it("INACTIVE バリは編集不可", () => {
    expect(isVariationEditable(variation({ status: "INACTIVE" }))).toBe(false);
  });

  it("改訂明細（revisedDeliveryPrice あり）を含むバリは編集不可", () => {
    const v = variation({ lines: [line({ revisedDeliveryPrice: 800 })] });
    expect(isVariationEditable(v)).toBe(false);
  });

  it("セット構成内に改訂明細があるバリも編集不可（構成内まで走査）", () => {
    const v = variation({
      lines: [setGroup([line(), line({ revisedDeliveryPrice: 800 })])],
    });
    expect(isVariationEditable(v)).toBe(false);
  });
});
