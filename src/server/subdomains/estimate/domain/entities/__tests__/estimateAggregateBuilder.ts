import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

import { EmergencyReason } from "../../values/EmergencyReason";
import { EstimateNumber } from "../../values/EstimateNumber";
import { FaultDescription } from "../../values/FaultDescription";
import { ItemName } from "../../values/ItemName";
import { Money } from "../../values/Money";
import { Quantity } from "../../values/Quantity";
import { Unit } from "../../values/Unit";
import { RevisedEstimateItemDetail } from "../RevisedEstimateItemDetail";
import { SubmissionType } from "../../values/SubmissionType";
import { TaxRate } from "../../values/TaxRate";
import { TaxRoundingType } from "../../values/TaxRoundingType";
import { AfterRepairEstimateDetail } from "../AfterRepairEstimateDetail";
import { Estimate } from "../Estimate";
import { EstimateItem } from "../EstimateItem";
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
  opts: { variationNumbers?: number[] } = {}
): Estimate {
  const variationNumbers = opts.variationNumbers ?? [1];
  const variations = variationNumbers.map((n, idx) =>
    makeVariation(ids.productId, n, [
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
    ])
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
