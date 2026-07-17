import { SubmissionType } from "../values/SubmissionType";
import type { EstimateVariationId } from "../values/EstimateVariationId";
import { EstimateItem } from "./EstimateItem";
import { EstimateSetGroup } from "./EstimateSetGroup";
import { EstimateVariation, type TaxContext } from "./EstimateVariation";
import { RevisedEstimateItemDetail } from "./RevisedEstimateItemDetail";
import type {
  EstimateItemDescriptor,
  EstimateSetGroupDescriptor,
  EstimateVariationDescriptor,
  RevisedVariationDescriptor,
  VariationDescriptorBase,
} from "./EstimateFactory";

/**
 * 見積集約の子エンティティ構築を担う共有ビルダー群。
 *
 * **配置理由（集約境界規約）**: 子エンティティ（EstimateItem / EstimateSetGroup /
 * EstimateVariation / 改訂明細詳細）の構築は集約内からのみ許される（eslint
 * no-restricted-imports）。`EstimateFactory`（複製・新規生成）と `Estimate`（得意先改訂）の
 * 両方が「単価再解決を伴う引き継ぎ生成」で同じ子構築を行うため、その構築ロジックを本モジュールへ
 * 一本化する（#603・#602 型の取りこぼしを構造的に潰す）。バレル（index.ts）には出さない
 * 内部ユーティリティで、`domain/entities/` 内からの相対 import のみを想定する。
 *
 * 本モジュールは子エンティティのみを相対 import し `Estimate` を import しない（循環なし）。
 * 記述子型は `EstimateFactory` から `import type`（実体は伴わない）で参照する。
 */

/**
 * 子構築に必要な記述子の形状（通常明細＋セット群）。バリエーション記述子・内容記述子・
 * 引き継ぎ生成記述子（`Copied*` / `Revised*`）が構造的に満たす。後者の明細型は
 * {@link EstimateItemDescriptor} の部分集合ないし強化（必須 `Money` → optional `Money | null`）
 * のため、追加の変換なしにそのまま渡せる。
 */
type VariationChildrenDescriptor = VariationDescriptorBase<EstimateItemDescriptor>;

/** 明細記述子（値オブジェクト止まり）から末端明細を構築する。改訂明細詳細は納品価格 VO から構築する。 */
export function buildItem(item: EstimateItemDescriptor): EstimateItem {
  return EstimateItem.create({
    productId: item.productId,
    sortOrder: item.sortOrder,
    itemName: item.itemName,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    discountRate: item.discountRate,
    itemDiscount: item.itemDiscount,
    customerMemo: item.customerMemo,
    internalMemo: item.internalMemo,
    revisedDetail:
      item.revisedDeliveryPrice != null
        ? RevisedEstimateItemDetail.create(item.revisedDeliveryPrice)
        : null,
  });
}

/**
 * セット群記述子（入れ子の構成明細を持つ）から、群エンティティと平坦化した構成明細を構築する。
 *
 * **会員解決**: 構成明細を先に `EstimateItem.create` して id を確定させ、その id を群の
 * `memberItemIds` へ配線する。群は実体ではなく順序付き id のみを保持し（案2-α）、構成明細の
 * 実体は呼び出し側が明細配列へ同居させる（ADR-0047）。
 */
export function buildSetGroups(descriptors: EstimateSetGroupDescriptor[]): {
  groups: EstimateSetGroup[];
  componentItems: EstimateItem[];
} {
  const groups: EstimateSetGroup[] = [];
  const componentItems: EstimateItem[] = [];
  for (const descriptor of descriptors) {
    const components = descriptor.components.map(buildItem);
    componentItems.push(...components);
    groups.push(
      EstimateSetGroup.create({
        productId: descriptor.productId,
        itemName: descriptor.itemName,
        unit: descriptor.unit,
        memberItemIds: components.map((c) => c.id),
        customerMemo: descriptor.customerMemo,
        internalMemo: descriptor.internalMemo,
      })
    );
  }
  return { groups, componentItems };
}

/**
 * 通常明細＋セット群の記述子から、価格付き末端行（通常明細＋構成明細を 1 配列に同居・ADR-0047）と
 * 群エンティティを構築する。複製・新規生成の {@link buildVariation} と得意先改訂の
 * `buildRevisedVariation` が共有する土台。
 */
export function buildVariationChildren(descriptor: VariationChildrenDescriptor): {
  items: EstimateItem[];
  setGroups: EstimateSetGroup[];
} {
  const normalItems = descriptor.items.map(buildItem);
  const { groups, componentItems } = buildSetGroups(descriptor.setGroups ?? []);
  return { items: [...normalItems, ...componentItems], setGroups: groups };
}

/**
 * バリエーション記述子から子明細を構築し {@link EstimateVariation} を生成する（複製・新規生成の経路）。
 * 得意先改訂の系譜（`revisedFrom`）は受け取らない。改訂は `buildRevisedVariation` を用いる（#603）。
 */
export function buildVariation(
  variation: EstimateVariationDescriptor,
  tax: TaxContext
): EstimateVariation {
  const { items, setGroups } = buildVariationChildren(variation);
  return EstimateVariation.create({
    variationNumber: variation.variationNumber,
    submissionType: variation.submissionType,
    tax,
    items,
    setGroups,
    overallDiscount: variation.overallDiscount,
    customerMemo: variation.customerMemo,
    internalMemo: variation.internalMemo,
  });
}

/**
 * 得意先改訂で生まれるバリエーションを改訂先記述子から構築する（#603・C7・§7.2）。
 *
 * 通常の {@link buildVariation} と分離し、改訂固有の系譜（`revisedFrom` 必須）と固定属性を
 * ビルダー側で確定する:
 * - `submissionType` は得意先宛（CUSTOMER）固定。「改訂先は常に得意先宛」の不変則はここ 1 箇所で
 *   表現し、記述子には持たせない（持たせても無視される死にフィールドになる）。
 * - `revisedFrom` を必須引数で受け取り出自を刻む（通常経路が名乗れない状態を型で保つ）。
 * - 全体値引 `overallDiscount` は付与しない（クリア・ADR-20260714-pv8）。記述子の核に無い。
 *
 * 明細の固定値引不可・改訂明細詳細（deliveryPrice スナップショット）・セット群の群ごと複写は、
 * {@link buildVariationChildren}（＝複製経路と共有の土台）と {@link RevisedVariationDescriptor} が担保する。
 */
export function buildRevisedVariation(
  descriptor: RevisedVariationDescriptor,
  ctx: { tax: TaxContext; revisedFrom: EstimateVariationId }
): EstimateVariation {
  const { items, setGroups } = buildVariationChildren(descriptor);
  return EstimateVariation.create({
    variationNumber: descriptor.variationNumber,
    submissionType: SubmissionType.CUSTOMER,
    revisedFrom: ctx.revisedFrom,
    tax: ctx.tax,
    items,
    setGroups,
    // overallDiscount は付与しない（クリア・ADR-20260714-pv8）
    customerMemo: descriptor.customerMemo,
    internalMemo: descriptor.internalMemo,
  });
}
