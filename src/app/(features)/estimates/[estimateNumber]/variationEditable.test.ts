import { describe, expect, it } from "vitest";
import type {
  LineDTO,
  SetGroupDTO,
  VariationDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import {
  isVariationDuplicatable,
  isVariationEditable,
  isVariationRevisableForCustomer,
} from "./variationEditable";

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
    revisionRole: "NONE",
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

describe("isVariationDuplicatable（複製元の適格性・C3）", () => {
  it("改訂明細を含まないバリは複製元にできる", () => {
    expect(isVariationDuplicatable(variation({ lines: [line()] }))).toBe(true);
  });

  it("改訂明細（revisedDeliveryPrice あり）を含むバリは複製元にできない", () => {
    const v = variation({ lines: [line({ revisedDeliveryPrice: 800 })] });
    expect(isVariationDuplicatable(v)).toBe(false);
  });

  it("セット構成内に改訂明細があるバリも複製元にできない（構成内まで走査）", () => {
    const v = variation({ lines: [setGroup([line(), line({ revisedDeliveryPrice: 800 })])] });
    expect(isVariationDuplicatable(v)).toBe(false);
  });

  it("無効(INACTIVE)でも改訂明細を含まなければ複製元にできる（状態を問わない・編集可否との差）", () => {
    expect(isVariationDuplicatable(variation({ status: "INACTIVE", lines: [line()] }))).toBe(true);
  });
});

describe("isVariationRevisableForCustomer（改訂元の適格性・C7）", () => {
  it("納品先宛(DELIVERY_LOCATION)かつ ACTIVE のバリは改訂元にできる（tracer bullet）", () => {
    const v = variation({ submissionType: "DELIVERY_LOCATION", status: "ACTIVE" });
    expect(isVariationRevisableForCustomer(v)).toBe(true);
  });

  it("得意先宛(CUSTOMER)のバリは改訂元にできない（ドメイン isDeliveryLocation ガードの写し）", () => {
    const v = variation({ submissionType: "CUSTOMER", status: "ACTIVE" });
    expect(isVariationRevisableForCustomer(v)).toBe(false);
  });

  it("無効(INACTIVE)の納品先宛バリは改訂元にできない（ドメイン isActive ガードの写し）", () => {
    const v = variation({ submissionType: "DELIVERY_LOCATION", status: "INACTIVE" });
    expect(isVariationRevisableForCustomer(v)).toBe(false);
  });

  it("既に改訂明細を含む納品先宛 ACTIVE バリも改訂元にできる（再改訂許可・凍結判定は持たない）", () => {
    const v = variation({
      submissionType: "DELIVERY_LOCATION",
      status: "ACTIVE",
      lines: [line({ revisedDeliveryPrice: 800 })],
    });
    expect(isVariationRevisableForCustomer(v)).toBe(true);
  });
});
