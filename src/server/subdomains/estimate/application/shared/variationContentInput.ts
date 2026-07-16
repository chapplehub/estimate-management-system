import { ProductId } from "@subdomains/product/domain/values/ProductId";
import {
  type EstimateItemDescriptor,
  type EstimateSetGroupDescriptor,
  type VariationContentDescriptor,
} from "@subdomains/estimate/domain/entities";
import { DiscountRate } from "@subdomains/estimate/domain/values/DiscountRate";
import { ItemName } from "@subdomains/estimate/domain/values/ItemName";
import { Memo } from "@subdomains/estimate/domain/values/Memo";
import { Money } from "@server/shared/domain/values/Money";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import { Unit } from "@subdomains/estimate/domain/values/Unit";

/** 明細入力オブジェクト参照 → 解決済み見積単価（`Money`）の索引（ADR-0064）。 */
export type LinePriceMap = ReadonlyMap<EstimateItemInput, Money>;

/**
 * 明細の入力（プリミティブ。金額は major units = 円）。C3 AddVariation / C4 UpdateVariation で共用。
 *
 * 見積単価は入力に含めない（ADR-0064）。商品選択＝明細生成時にサーバーが価格決定（#428）で
 * 権威解決・固定する。クライアントから単価を受け取らない。
 */
export type EstimateItemInput = {
  productId: string;
  sortOrder: number;
  itemName: string;
  quantity: number;
  unit: string;
  /**
   * C4 内容編集で既存明細を突合する任意キー（ADR-20260709-5ea）。現行集約の同一 itemId・同一 productId
   * の行と一致すれば永続単価を保全し価格決定を呼ばない。C3 追加や新規行では未指定（＝新規解決）。
   */
  itemId?: string;
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
 *
 * 見積単価は入力に持たず、価格決定で解決済みの `priceMap`（明細入力オブジェクト参照 → `Money`）から
 * 引く（ADR-0064）。解決は呼び出し側コマンドが `resolveLineTreePrices` で先に行う。
 */
export function toVariationContentDescriptor(
  input: VariationContentInput,
  priceMap: LinePriceMap
): VariationContentDescriptor {
  return {
    items: input.items.map((item) => toEstimateItemDescriptor(item, priceMap)),
    // フォーム入力境界の undefined をここで空配列へ正規化する（記述子側は必須・#617）
    setGroups: (input.setGroups ?? []).map((group) =>
      toEstimateSetGroupDescriptor(group, priceMap)
    ),
    overallDiscount:
      input.overallDiscount != null ? Money.fromMajorUnits(input.overallDiscount) : undefined,
    customerMemo: input.customerMemo != null ? Memo.create(input.customerMemo) : undefined,
    internalMemo: input.internalMemo != null ? Memo.create(input.internalMemo) : undefined,
  };
}

function toEstimateSetGroupDescriptor(
  group: EstimateSetGroupInput,
  priceMap: LinePriceMap
): EstimateSetGroupDescriptor {
  return {
    productId: new ProductId(group.productId),
    itemName: new ItemName(group.itemName),
    unit: new Unit(group.unit),
    components: group.components.map((item) => toEstimateItemDescriptor(item, priceMap)),
    customerMemo: group.customerMemo != null ? Memo.create(group.customerMemo) : undefined,
    internalMemo: group.internalMemo != null ? Memo.create(group.internalMemo) : undefined,
  };
}

function toEstimateItemDescriptor(
  item: EstimateItemInput,
  priceMap: LinePriceMap
): EstimateItemDescriptor {
  const unitPrice = priceMap.get(item);
  if (unitPrice === undefined) {
    // 解決済み単価が索引に無いのは呼び出し側の平坦化漏れ＝内部不整合（ADR-0064）。
    throw new Error("明細の見積単価が解決されていません（内部エラー）");
  }
  return {
    productId: new ProductId(item.productId),
    sortOrder: item.sortOrder,
    itemName: new ItemName(item.itemName),
    quantity: new Quantity(item.quantity),
    unit: new Unit(item.unit),
    unitPrice,
    discountRate: item.discountRate != null ? new DiscountRate(item.discountRate) : undefined,
    itemDiscount: item.itemDiscount != null ? Money.fromMajorUnits(item.itemDiscount) : undefined,
    customerMemo: item.customerMemo != null ? Memo.create(item.customerMemo) : undefined,
    internalMemo: item.internalMemo != null ? Memo.create(item.internalMemo) : undefined,
    revisedDeliveryPrice:
      item.revisedDeliveryPrice != null ? Money.fromMajorUnits(item.revisedDeliveryPrice) : null,
  };
}
