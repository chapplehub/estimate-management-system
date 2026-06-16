import { ProductId } from "@subdomains/product/domain/values/ProductId";
import {
  type EstimateItemDescriptor,
  type EstimateSetGroupDescriptor,
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

/**
 * セット群の入力（プリミティブ。ADR-0047）。構成明細を入れ子の `components` で持つ。
 *
 * app 入力境界はトップレベル判別子 union ではなく、ドメイン記述子と同形の items + setGroups と
 * する（後方互換・deviations.md §5）。往復形状 A の union は作業コピー／JSON（プレゼン層）に置く。
 */
export type EstimateSetGroupInput = {
  productId: string;
  /** 商品名スナップショット（SET 商品マスタからの複写）。 */
  itemName: string;
  /** 単位スナップショット。 */
  unit: string;
  /** 構成明細（入れ子）。空配列は不可（空群禁止は EstimateSetGroup.create が担保）。 */
  components: EstimateItemInput[];
  customerMemo?: string | null;
  internalMemo?: string | null;
};

/** バリエーション内容の入力（プリミティブ。バリエーション番号は含まない）。 */
export type VariationContentInput = {
  /** 通常明細（非セット）。構成明細は setGroups の入れ子側に持つ。 */
  items: EstimateItemInput[];
  /** セット群（ADR-0047）。各群が構成明細を入れ子で持つ。省略時は空（既存往復は不変）。 */
  setGroups?: EstimateSetGroupInput[];
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
    setGroups: input.setGroups?.map(toEstimateSetGroupDescriptor),
    overallDiscount:
      input.overallDiscount != null ? Money.fromMajorUnits(input.overallDiscount) : undefined,
    customerMemo: input.customerMemo != null ? Memo.create(input.customerMemo) : undefined,
    internalMemo: input.internalMemo != null ? Memo.create(input.internalMemo) : undefined,
  };
}

function toEstimateSetGroupDescriptor(group: EstimateSetGroupInput): EstimateSetGroupDescriptor {
  return {
    productId: new ProductId(group.productId),
    itemName: new ItemName(group.itemName),
    unit: new Unit(group.unit),
    components: group.components.map(toEstimateItemDescriptor),
    customerMemo: group.customerMemo != null ? Memo.create(group.customerMemo) : undefined,
    internalMemo: group.internalMemo != null ? Memo.create(group.internalMemo) : undefined,
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
