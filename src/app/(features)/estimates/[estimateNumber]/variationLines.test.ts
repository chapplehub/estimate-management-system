import { describe, expect, it } from "vitest";
import type { LineDTO } from "@subdomains/estimate/application/queries/dto/EstimateDetailDTO";
import { createWorkingLine, fromLineDTO } from "./variationLines";

const product = {
  id: "prod-1",
  code: "P001",
  name: "商品A",
  category: "INDIVIDUAL",
  unit: "個",
};

describe("createWorkingLine（商品スナップショット＋新規行既定値）", () => {
  it("商品名・単位・コード・区分をスナップショットし、既定値で行を作る", () => {
    const line = createWorkingLine("row-1", product);

    expect(line).toMatchObject({
      rowId: "row-1",
      productId: "prod-1",
      productCode: "P001",
      productCategory: "INDIVIDUAL",
      itemName: "商品A",
      unit: "個",
      quantity: 1, // 既定 数量1
      unitPrice: 0, // 既定 単価0（販売単価マスタ未確定＝要入力）
      discountRate: 1.0, // 既定 掛率1.0（値引なし）
      itemDiscount: 0, // 既定 値引0
      customerMemo: "",
      internalMemo: "",
    });
  });

  it("数値項目を上書きできる（周辺サジェストの数量＝relation の quantity）", () => {
    const line = createWorkingLine("row-1", product, { quantity: 3 });

    expect(line.quantity).toBe(3);
    expect(line.discountRate).toBe(1.0); // 他は新規行既定のまま
  });
});

describe("fromLineDTO（既存明細 DTO → 作業行）", () => {
  const dto: LineDTO = {
    kind: "line",
    itemId: "item-9",
    productId: "prod-1",
    productCode: "P001",
    productCategory: "INDIVIDUAL",
    isActive: true,
    itemName: "商品A",
    sortOrder: 1,
    quantity: 2,
    unit: "個",
    unitPrice: 1000,
    discountRate: 0.95,
    itemDiscount: 100,
    baseAmount: 2000,
    finalAmount: 1800,
    customerMemo: "顧客M",
    internalMemo: "社内M",
    revisedDeliveryPrice: null,
  };

  it("rowId に itemId を使い、各項目を写す", () => {
    const line = fromLineDTO(dto);

    expect(line).toEqual({
      kind: "line",
      rowId: "item-9",
      productId: "prod-1",
      productCode: "P001",
      productCategory: "INDIVIDUAL",
      isActive: true,
      itemName: "商品A",
      unit: "個",
      quantity: 2,
      unitPrice: 1000,
      discountRate: 0.95,
      itemDiscount: 100,
      customerMemo: "顧客M",
      internalMemo: "社内M",
    });
  });
});

// 注: 挿入・削除・並べ替え・ペイロード整形はノード版（insertNodesBelow / removeNode /
// reorderNodes / reorderComponents / toNodePayload）へ移行した（variationNodes.test.ts）。
