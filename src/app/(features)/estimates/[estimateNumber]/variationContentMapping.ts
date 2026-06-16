import type {
  EstimateItemInput,
  VariationContentInput,
} from "@subdomains/estimate/application/shared/variationContentInput";
import type { VariationLineInput, VariationNodeInput } from "./variationSchema";

/**
 * 検証済みノード配列（updateVariationContentNodeSchema の出力）を C4/C1 の
 * `VariationContentInput`（items ＋ setGroups）へ写す純関数。Server Action（"use server"）から
 * 同期ヘルパーを export できないため別モジュール。
 *
 * sortOrder は JSON に載せず「配列順 = 真実」（ADR-0050）に従い、通常明細・構成明細を**ノード配列の
 * 出現順で**連番 1..N する（単一の running counter）。セット群はその構成が占める連続区間に sortOrder を
 * 持ち、群の表示位置は構成の最小 sortOrder から導出される（ドメイン／read 側）。C4 は宣言的全置換。
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
