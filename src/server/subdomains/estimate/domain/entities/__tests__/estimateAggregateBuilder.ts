import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

import { EmergencyReason } from "../../values/approval/EmergencyReason";
import { EstimateNumber } from "../../values/EstimateNumber";
import { FaultDescription } from "../../values/FaultDescription";
import { ItemName } from "../../values/ItemName";
import { Memo } from "../../values/Memo";
import { Money } from "../../values/Money";
import { Quantity } from "../../values/Quantity";
import { Unit } from "../../values/Unit";
import { EstimateSetGroupId } from "../../values/EstimateSetGroupId";
import { RevisedEstimateItemDetail } from "../RevisedEstimateItemDetail";
import { SubmissionType } from "../../values/SubmissionType";
import { TaxRate } from "../../values/TaxRate";
import { TaxRoundingType } from "../../values/TaxRoundingType";
import { AfterRepairEstimateDetail } from "../AfterRepairEstimateDetail";
import { Estimate } from "../Estimate";
import { EstimateItem } from "../EstimateItem";
import { EstimateSetGroup } from "../EstimateSetGroup";
import { EstimateVariation, type TaxContext } from "../EstimateVariation";
import { RepairEstimateDetail } from "../RepairEstimateDetail";

/**
 * 見積集約のテストデータビルダー（集約内 entities/** に配置）。
 *
 * 集約境界規約により子エンティティ（EstimateVariation / EstimateItem 等）は
 * 集約外から直接 import できない。リポジトリ等のテストが有効な集約を組み立てられるよう、
 * 子エンティティの生成をここ（import が許可される集約内）に集約し、Estimate を返す。
 */

/** テスト用 FK マスタの ID 群（ensureEstimateFixtures が返す文字列 ID）。 */
export type EstimateFixtureIds = {
  departmentId: string;
  employeeId: string;
  customerId: string;
  deliveryLocationId: string;
  productId: string;
  /** セット群（ADR-0047）テスト用の SET 区分商品。 */
  setProductId: string;
};

export const TAX_CONTEXT: TaxContext = {
  taxRate: new TaxRate(0.1),
  taxRoundingType: TaxRoundingType.ROUND_DOWN,
};

export function makeItem(
  productId: string,
  opts: {
    sortOrder?: number;
    itemName?: string;
    unitPrice?: number;
    quantity?: number;
    withRevisedDetail?: boolean;
  } = {}
): EstimateItem {
  return EstimateItem.create({
    productId: new ProductId(productId),
    sortOrder: opts.sortOrder ?? 1,
    itemName: new ItemName(opts.itemName ?? "テスト商品"),
    quantity: new Quantity(opts.quantity ?? 1),
    unit: new Unit("個"),
    unitPrice: Money.fromMajorUnits(opts.unitPrice ?? 1000),
    revisedDetail: opts.withRevisedDetail
      ? RevisedEstimateItemDetail.create(Money.fromMajorUnits(800))
      : null,
  });
}

export function makeVariation(
  productId: string,
  variationNumber: number,
  items?: EstimateItem[],
  submissionType: SubmissionType = SubmissionType.CUSTOMER
): EstimateVariation {
  return EstimateVariation.create({
    variationNumber,
    submissionType,
    tax: TAX_CONTEXT,
    items: items ?? [makeItem(productId, { sortOrder: 1 })],
  });
}

function header(ids: EstimateFixtureIds) {
  return {
    estimateDate: new Date("2025-04-01T00:00:00.000Z"),
    deadline: new Date("2025-04-30T00:00:00.000Z"),
    customerId: new CustomerId(ids.customerId),
    deliveryLocationId: new DeliveryLocationId(ids.deliveryLocationId),
    taxRate: TAX_CONTEXT.taxRate,
    taxRoundingType: TAX_CONTEXT.taxRoundingType,
    createdBy: new EmployeeId(ids.employeeId),
    departmentId: new DepartmentId(ids.departmentId),
  };
}

/**
 * NEW 見積を生成する。デフォルトで 1 バリエーション・2 明細（うち 1 件に改訂明細詳細）。
 */
export function buildNewEstimate(
  ids: EstimateFixtureIds,
  estimateNumber: string,
  opts: { variationNumbers?: number[]; submissionType?: SubmissionType } = {}
): Estimate {
  const variationNumbers = opts.variationNumbers ?? [1];
  const variations = variationNumbers.map((n, idx) =>
    makeVariation(
      ids.productId,
      n,
      [
        makeItem(ids.productId, {
          sortOrder: 1,
          itemName: `商品A-${idx}`,
          unitPrice: 1000,
          quantity: 2,
        }),
        makeItem(ids.productId, {
          sortOrder: 2,
          itemName: `商品B-${idx}`,
          unitPrice: 500,
          quantity: 1,
          withRevisedDetail: true,
        }),
      ],
      opts.submissionType
    )
  );
  return Estimate.create({
    ...header(ids),
    estimateNumber: EstimateNumber.parse(estimateNumber),
    variations,
  });
}

/** REPAIR 見積（事前修理）を生成する。 */
export function buildRepairEstimate(ids: EstimateFixtureIds, estimateNumber: string): Estimate {
  return Estimate.create({
    ...header(ids),
    estimateNumber: EstimateNumber.parse(estimateNumber),
    variations: [makeVariation(ids.productId, 1)],
    repairDetail: RepairEstimateDetail.create({
      targetProductId: new ProductId(ids.productId),
      faultDescription: new FaultDescription("電源が入らない"),
      scheduledRepairDate: new Date("2025-05-10T00:00:00.000Z"),
    }),
  });
}

/** AFTER_REPAIR 見積（事後修理）を生成する。 */
export function buildAfterRepairEstimate(
  ids: EstimateFixtureIds,
  estimateNumber: string
): Estimate {
  return Estimate.create({
    ...header(ids),
    estimateNumber: EstimateNumber.parse(estimateNumber),
    variations: [makeVariation(ids.productId, 1)],
    afterRepairDetail: AfterRepairEstimateDetail.create({
      targetProductId: new ProductId(ids.productId),
      faultDescription: new FaultDescription("基板焼損"),
      actualRepairDate: new Date("2025-03-20T00:00:00.000Z"),
      emergencyReason: new EmergencyReason("顧客ライン停止のため緊急対応"),
    }),
  });
}

// ========================================
// セット群（ADR-0047 / Shape ③-a）テスト用ビルダー
// ========================================

/**
 * セット群を生成する。`id` を渡すと reconstruct で同一 id の群を作る（diff-upsert の
 * identity 保持テストで、state A の群 id を state B でも使うため）。省略時は create（新 id）。
 */
export function makeSetGroup(
  setProductId: string,
  members: ReadonlyArray<Readonly<EstimateItem>>,
  opts: { itemName?: string; id?: EstimateSetGroupId } = {}
): EstimateSetGroup {
  const productId = new ProductId(setProductId);
  const itemName = new ItemName(opts.itemName ?? "テストセット商品");
  const unit = new Unit("式");
  const memberItemIds = members.map((m) => m.id);

  if (opts.id) {
    return EstimateSetGroup.reconstruct({
      id: opts.id,
      productId,
      itemName,
      unit,
      customerMemo: Memo.empty(),
      internalMemo: Memo.empty(),
      memberItemIds,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return EstimateSetGroup.create({ productId, itemName, unit, memberItemIds });
}

/**
 * セット群を 1 つ持つ NEW 見積を生成する（構成明細 memberCount 件＋通常明細 1 件）。
 * 構成明細は sortOrder 1..memberCount・単価 (i+1)*1000、通常明細は末尾。
 */
export function buildEstimateWithSetGroup(
  ids: EstimateFixtureIds,
  estimateNumber: string,
  opts: { memberCount?: number } = {}
): Estimate {
  const memberCount = opts.memberCount ?? 2;
  const members = Array.from({ length: memberCount }, (_, idx) =>
    makeItem(ids.productId, {
      sortOrder: idx + 1,
      itemName: `構成${idx + 1}`,
      unitPrice: (idx + 1) * 1000,
    })
  );
  const normal = makeItem(ids.productId, {
    sortOrder: memberCount + 1,
    itemName: "通常明細",
    unitPrice: 500,
  });
  const variation = EstimateVariation.create({
    variationNumber: 1,
    submissionType: SubmissionType.CUSTOMER,
    tax: TAX_CONTEXT,
    items: [...members, normal],
    setGroups: [makeSetGroup(ids.setProductId, members)],
  });
  return Estimate.create({
    ...header(ids),
    estimateNumber: EstimateNumber.parse(estimateNumber),
    variations: [variation],
  });
}

/**
 * セット群を 2 つ持つ NEW 見積を生成する（群A=[構成1, 構成2]、群B=[構成3]）。
 * 群間移動・群削除・新群追加の diff-upsert テスト用。
 */
export function buildEstimateWithTwoSetGroups(
  ids: EstimateFixtureIds,
  estimateNumber: string
): Estimate {
  const c1 = makeItem(ids.productId, { sortOrder: 1, itemName: "構成1", unitPrice: 1000 });
  const c2 = makeItem(ids.productId, { sortOrder: 2, itemName: "構成2", unitPrice: 2000 });
  const c3 = makeItem(ids.productId, { sortOrder: 3, itemName: "構成3", unitPrice: 3000 });
  const variation = EstimateVariation.create({
    variationNumber: 1,
    submissionType: SubmissionType.CUSTOMER,
    tax: TAX_CONTEXT,
    items: [c1, c2, c3],
    setGroups: [
      makeSetGroup(ids.setProductId, [c1, c2], { itemName: "セットA" }),
      makeSetGroup(ids.setProductId, [c3], { itemName: "セットB" }),
    ],
  });
  return Estimate.create({
    ...header(ids),
    estimateNumber: EstimateNumber.parse(estimateNumber),
    variations: [variation],
  });
}

/**
 * 単一バリエーション見積 `base` を土台に、そのバリエーションのセット群だけを差し替えた
 * Estimate を reconstruct で組み立てる（diff-upsert の id 固定 2 状態を作る）。
 * 明細インスタンス・ヘッダ・集計はそのまま流用する（S1 はセット群 mutator を持たないため）。
 */
export function reconstructWithSetGroups(base: Estimate, setGroups: EstimateSetGroup[]): Estimate {
  const v = base.variations[0];
  const variation = EstimateVariation.reconstruct({
    id: v.id,
    variationNumber: v.variationNumber,
    submissionType: v.submissionType,
    revisedFrom: v.revisedFrom,
    status: v.status,
    customerMemo: v.customerMemo,
    internalMemo: v.internalMemo,
    overallDiscount: v.overallDiscount,
    items: [...v.items] as EstimateItem[],
    setGroups,
    subtotal: v.subtotal,
    discountSubtotal: v.discountSubtotal,
    finalSubtotal: v.finalSubtotal,
    taxAmount: v.taxAmount,
    finalTotal: v.finalTotal,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  });
  return Estimate.reconstruct({
    id: base.id,
    estimateNumber: base.estimateNumber,
    estimateDate: base.estimateDate,
    deadline: base.deadline,
    customerId: base.customerId,
    deliveryLocationId: base.deliveryLocationId,
    taxRate: base.taxRate,
    taxRoundingType: base.taxRoundingType,
    createdBy: base.createdBy,
    departmentId: base.departmentId,
    variations: [variation],
    repairDetail: base.repairDetail,
    afterRepairDetail: base.afterRepairDetail,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  });
}
