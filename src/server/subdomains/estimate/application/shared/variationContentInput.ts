import { ProductId } from "@subdomains/product/domain/values/ProductId";
import {
  type EstimateItemDescriptor,
  type VariationContentDescriptor,
} from "@subdomains/estimate/domain/entities";
import { DiscountRate } from "@subdomains/estimate/domain/values/DiscountRate";
import { ItemName } from "@subdomains/estimate/domain/values/ItemName";
import { Memo } from "@subdomains/estimate/domain/values/Memo";
import { Money } from "@subdomains/estimate/domain/values/Money";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import { Unit } from "@subdomains/estimate/domain/values/Unit";

/** 明細の入力（プリミティブ。金額は major units = 円）。C3 AddVariation / C4 UpdateVariation で共用。 */
export type EstimateItemInput = {
  productId: string;
  sortOrder: number;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate?: number;
  itemDiscount?: number;
  customerMemo?: string | null;
  internalMemo?: string | null;
  /** 得意先改訂で生まれた明細のみ持つ納品価格（円）。指定時のみ改訂明細詳細を構築する。 */
  revisedDeliveryPrice?: number | null;
};

/** バリエーション内容の入力（プリミティブ。バリエーション番号は含まない）。 */
export type VariationContentInput = {
  items: EstimateItemInput[];
  overallDiscount?: number;
  customerMemo?: string | null;
  internalMemo?: string | null;
};

/**
 * プリミティブのバリエーション内容入力を、ドメインの番号なし記述子（VO 止まり）へ変換する。
 * 子エンティティの構築は EstimateFactory.buildVariationContent が担う（集約境界規約）。
 */
export function toVariationContentDescriptor(
  input: VariationContentInput
): VariationContentDescriptor {
  return {
    items: input.items.map(toEstimateItemDescriptor),
    overallDiscount:
      input.overallDiscount != null ? Money.fromMajorUnits(input.overallDiscount) : undefined,
    customerMemo: input.customerMemo != null ? Memo.create(input.customerMemo) : undefined,
    internalMemo: input.internalMemo != null ? Memo.create(input.internalMemo) : undefined,
  };
}

function toEstimateItemDescriptor(item: EstimateItemInput): EstimateItemDescriptor {
  return {
    productId: new ProductId(item.productId),
    sortOrder: item.sortOrder,
    itemName: new ItemName(item.itemName),
    quantity: new Quantity(item.quantity),
    unit: new Unit(item.unit),
    unitPrice: Money.fromMajorUnits(item.unitPrice),
    discountRate: item.discountRate != null ? new DiscountRate(item.discountRate) : undefined,
    itemDiscount: item.itemDiscount != null ? Money.fromMajorUnits(item.itemDiscount) : undefined,
    customerMemo: item.customerMemo != null ? Memo.create(item.customerMemo) : undefined,
    internalMemo: item.internalMemo != null ? Memo.create(item.internalMemo) : undefined,
    revisedDeliveryPrice:
      item.revisedDeliveryPrice != null ? Money.fromMajorUnits(item.revisedDeliveryPrice) : null,
  };
}
