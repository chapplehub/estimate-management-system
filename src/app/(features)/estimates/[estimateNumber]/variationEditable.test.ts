import { describe, expect, it } from "vitest";
import type {
  LineDTO,
  SetGroupDTO,
  VariationDTO,
} from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import {
  isVariationAdjustable,
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

describe("isVariationEditable（revisionRole 駆動・ADR-0059）", () => {
  it("改訂に関与しない(NONE) ACTIVE バリは編集可能", () => {
    expect(isVariationEditable(variation({ revisionRole: "NONE", lines: [line()] }))).toBe(true);
  });

  it("セット群を含む NONE・ACTIVE バリも編集可能（編集可否は明細内容に依存しない）", () => {
    const v = variation({ revisionRole: "NONE", lines: [setGroup([line(), line()]), line()] });
    expect(isVariationEditable(v)).toBe(true);
  });

  it("INACTIVE バリは編集不可", () => {
    expect(isVariationEditable(variation({ status: "INACTIVE" }))).toBe(false);
  });

  it("改訂元(REVISION_SOURCE・凍結)は ACTIVE でも編集不可（本 issue のバグ修正核心）", () => {
    const v = variation({ revisionRole: "REVISION_SOURCE", status: "ACTIVE" });
    expect(isVariationEditable(v)).toBe(false);
  });

  it("改訂先(REVISION_TARGET)は編集不可（粒度別編集は #390 で別途）", () => {
    const v = variation({ revisionRole: "REVISION_TARGET", status: "ACTIVE" });
    expect(isVariationEditable(v)).toBe(false);
  });
});

describe("isVariationDuplicatable（複製元の適格性・C3）", () => {
  it("改訂に関与しない(NONE)バリは複製元にできる", () => {
    expect(isVariationDuplicatable(variation({ revisionRole: "NONE" }))).toBe(true);
  });

  it("改訂元(REVISION_SOURCE)は複製元にできる（凍結スナップショットを含まない素の土台）", () => {
    expect(isVariationDuplicatable(variation({ revisionRole: "REVISION_SOURCE" }))).toBe(true);
  });

  it("改訂先(REVISION_TARGET)は複製元にできない（改訂スナップショットは系譜と不可分）", () => {
    expect(isVariationDuplicatable(variation({ revisionRole: "REVISION_TARGET" }))).toBe(false);
  });

  it("無効(INACTIVE)でも NONE なら複製元にできる（状態を問わない・編集可否との差）", () => {
    expect(isVariationDuplicatable(variation({ status: "INACTIVE", revisionRole: "NONE" }))).toBe(
      true
    );
  });
});

describe("isVariationAdjustable（改訂先の部分編集ボタンの適格性・#390）", () => {
  it("改訂先(REVISION_TARGET)かつ ACTIVE のバリは価格調整できる", () => {
    const v = variation({ revisionRole: "REVISION_TARGET", status: "ACTIVE" });
    expect(isVariationAdjustable(v)).toBe(true);
  });

  it("改訂に関与しない(NONE)バリは価格調整ボタンの対象外（通常の「内容を編集」を使う）", () => {
    expect(isVariationAdjustable(variation({ revisionRole: "NONE", status: "ACTIVE" }))).toBe(
      false
    );
  });

  it("改訂元(REVISION_SOURCE)は価格調整できない（凍結・メモのみ可）", () => {
    expect(
      isVariationAdjustable(variation({ revisionRole: "REVISION_SOURCE", status: "ACTIVE" }))
    ).toBe(false);
  });

  it("無効(INACTIVE)の改訂先は価格調整できない（§3.4 無効は編集不可）", () => {
    expect(
      isVariationAdjustable(variation({ revisionRole: "REVISION_TARGET", status: "INACTIVE" }))
    ).toBe(false);
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

  it("既に改訂元(REVISION_SOURCE)の納品先宛 ACTIVE バリも改訂元にできる（再改訂許可・凍結判定は持たない）", () => {
    const v = variation({
      submissionType: "DELIVERY_LOCATION",
      status: "ACTIVE",
      revisionRole: "REVISION_SOURCE",
    });
    expect(isVariationRevisableForCustomer(v)).toBe(true);
  });
});
