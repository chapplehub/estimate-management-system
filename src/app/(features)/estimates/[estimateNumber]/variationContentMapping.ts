import type {
  EstimateItemInput,
  VariationContentInput,
} from "@subdomains/estimate/application/shared/variationContentInput";
import type { VariationLineInput, VariationNodeInput } from "./variationSchema";

/**
 * 検証済みフォーム値（updateVariationContentSchema の出力）を C4 の `VariationContentInput`
 * へ写す純関数。Server Action（"use server"）から同期ヘルパーを export できないため別モジュール。
 *
 * sortOrder は JSON に載せず、ここで「配列順 = 真実」（ADR-0050）に従って 1..N を導出する。
 * C4 は宣言的全置換なので、受け取った順序がそのまま新しい表示順になる。
 */
export type ValidatedVariationContent = {
  lines: VariationLineInput[];
  overallDiscount: number;
  // conform は空フィールドを undefined 化するため optional（ADR-0034 の Null Object に対応）。
  customerMemo?: string;
  internalMemo?: string;
};

export function toVariationContentInput(value: ValidatedVariationContent): VariationContentInput {
  return {
    items: value.lines.map((line, index) => ({
      productId: line.productId,
      sortOrder: index + 1,
      itemName: line.itemName,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      discountRate: line.discountRate,
      itemDiscount: line.itemDiscount,
      customerMemo: line.customerMemo,
      internalMemo: line.internalMemo,
    })),
    overallDiscount: value.overallDiscount,
    customerMemo: value.customerMemo,
    internalMemo: value.internalMemo,
  };
}

/**
 * セット群対応版（S5）。検証済みノード配列（updateVariationContentNodeSchema の出力）を C4/C1 の
 * `VariationContentInput`（items ＋ setGroups）へ写す純関数。
 *
 * sortOrder は「配列順 = 真実」（ADR-0050）に従い、通常明細・構成明細を**ノード配列の出現順で**
 * 連番 1..N する（単一の running counter）。セット群はその構成が占める連続区間に sortOrder を持ち、
 * 群の表示位置は構成の最小 sortOrder から導出される（ドメイン／read 側）。
 */
export type ValidatedVariationContentNodes = {
  nodes: VariationNodeInput[];
  overallDiscount: number;
  customerMemo?: string;
  internalMemo?: string;
};

export function toVariationContentInputFromNodes(
  value: ValidatedVariationContentNodes
): VariationContentInput {
  const items: EstimateItemInput[] = [];
  const setGroups: NonNullable<VariationContentInput["setGroups"]> = [];
  let sortOrder = 1;

  for (const node of value.nodes) {
    if (node.kind === "setGroup") {
      const components = node.components.map((line) => toItemInput(line, sortOrder++));
      setGroups.push({
        productId: node.productId,
        itemName: node.itemName,
        unit: node.unit,
        components,
        customerMemo: node.customerMemo,
        internalMemo: node.internalMemo,
      });
    } else {
      items.push(toItemInput(node, sortOrder++));
    }
  }

  return {
    items,
    setGroups,
    overallDiscount: value.overallDiscount,
    customerMemo: value.customerMemo,
    internalMemo: value.internalMemo,
  };
}

function toItemInput(line: VariationLineInput, sortOrder: number): EstimateItemInput {
  return {
    productId: line.productId,
    sortOrder,
    itemName: line.itemName,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    discountRate: line.discountRate,
    itemDiscount: line.itemDiscount,
    customerMemo: line.customerMemo,
    internalMemo: line.internalMemo,
  };
}
