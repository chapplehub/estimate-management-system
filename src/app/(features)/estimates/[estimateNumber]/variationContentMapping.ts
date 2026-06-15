import type { VariationContentInput } from "@subdomains/estimate/application/shared/variationContentInput";
import type { VariationLineInput } from "./variationSchema";

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
  customerMemo: string;
  internalMemo: string;
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
