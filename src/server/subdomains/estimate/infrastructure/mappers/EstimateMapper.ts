import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";

import { Estimate } from "@subdomains/estimate/domain/entities/Estimate";
// 集約境界規約の正当な例外（eslint.config.mjs の本ファイル限定 override）:
// 永続化からの集約再構築のため、子エンティティの reconstruct() を直接呼ぶ。
import { AfterRepairEstimateDetail } from "@subdomains/estimate/domain/entities/AfterRepairEstimateDetail";
import { EstimateItem } from "@subdomains/estimate/domain/entities/EstimateItem";
import { EstimateVariation } from "@subdomains/estimate/domain/entities/EstimateVariation";
import { RepairEstimateDetail } from "@subdomains/estimate/domain/entities/RepairEstimateDetail";
import { RevisedEstimateItemDetail } from "@subdomains/estimate/domain/entities/RevisedEstimateItemDetail";

import { AfterRepairEstimateDetailId } from "@subdomains/estimate/domain/values/AfterRepairEstimateDetailId";
import { DiscountRate } from "@subdomains/estimate/domain/values/DiscountRate";
import { EmergencyReason } from "@subdomains/estimate/domain/values/EmergencyReason";
import { EstimateId } from "@subdomains/estimate/domain/values/EstimateId";
import { EstimateItemId } from "@subdomains/estimate/domain/values/EstimateItemId";
import { EstimateNumber } from "@subdomains/estimate/domain/values/EstimateNumber";
import { EstimateVariationId } from "@subdomains/estimate/domain/values/EstimateVariationId";
import { FaultDescription } from "@subdomains/estimate/domain/values/FaultDescription";
import { ItemName } from "@subdomains/estimate/domain/values/ItemName";
import { Memo } from "@subdomains/estimate/domain/values/Memo";
import { Money } from "@subdomains/estimate/domain/values/Money";
import { Quantity } from "@subdomains/estimate/domain/values/Quantity";
import { RepairEstimateDetailId } from "@subdomains/estimate/domain/values/RepairEstimateDetailId";
import { RevisedEstimateItemDetailId } from "@subdomains/estimate/domain/values/RevisedEstimateItemDetailId";
import { SubmissionType } from "@subdomains/estimate/domain/values/SubmissionType";
import { TaxRate } from "@subdomains/estimate/domain/values/TaxRate";
import { TaxRoundingType } from "@subdomains/estimate/domain/values/TaxRoundingType";
import { Unit } from "@subdomains/estimate/domain/values/Unit";
import { VariationStatus } from "@subdomains/estimate/domain/values/VariationStatus";

import { Prisma } from "@generated/prisma/client";
import type {
  EstimateType as PrismaEstimateType,
  SubmissionType as PrismaSubmissionType,
  TaxRoundingType as PrismaTaxRoundingType,
  VariationStatus as PrismaVariationStatus,
} from "@generated/prisma/enums";

/**
 * findById / findByEstimateNumber で集約を再構築するための include 定義。
 * 並び順を固定し、ラウンドトリップの決定性を保証する。
 */
export const ESTIMATE_FULL_INCLUDE = {
  variations: {
    orderBy: { variationNumber: "asc" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { revisedDetail: true },
      },
    },
  },
  repairDetail: true,
  afterRepairDetail: true,
} satisfies Prisma.EstimateInclude;

export type PrismaEstimateFull = Prisma.EstimateGetPayload<{
  include: typeof ESTIMATE_FULL_INCLUDE;
}>;

type PrismaVariationFull = PrismaEstimateFull["variations"][number];
type PrismaItemFull = PrismaVariationFull["items"][number];

/**
 * Decimal(12,2)（主単位 = 円・銭精度）と Money の相互変換。
 * JPY は scale=2（1円=100銭）。majorUnits ⇔ Decimal で対称。
 */
function decimalToMoney(value: Prisma.Decimal): Money {
  return Money.fromMajorUnits(Number(value));
}

function moneyToDecimal(money: Money): Prisma.Decimal {
  return new Prisma.Decimal(money.majorUnits);
}

/**
 * EstimateMapper
 *
 * 見積集約（Estimate → EstimateVariation → EstimateItem ＋ 修理系子エンティティ）と
 * Prisma レコードを相互変換する。集約境界規約の正当な例外として、子エンティティの
 * reconstruct() を直接呼ぶ（eslint override は本ファイルに限定）。
 */
export class EstimateMapper {
  // ========================================
  // toDomain（読み取り）
  // ========================================

  static toDomain(row: PrismaEstimateFull): Estimate {
    return Estimate.reconstruct({
      id: new EstimateId(row.id),
      estimateNumber: EstimateNumber.parse(row.estimateNumber),
      estimateDate: row.estimateDate,
      deadline: row.deadline,
      submissionType: SubmissionType.from(row.submissionType),
      customerId: new CustomerId(row.customerId),
      deliveryLocationId: new DeliveryLocationId(row.deliveryLocationId),
      taxRate: new TaxRate(Number(row.taxRate)),
      taxRoundingType: TaxRoundingType.from(row.taxRoundingType),
      createdBy: new EmployeeId(row.createdBy),
      departmentId: new DepartmentId(row.departmentId),
      variations: row.variations.map((v) => EstimateMapper.variationToDomain(v)),
      repairDetail: row.repairDetail
        ? RepairEstimateDetail.reconstruct({
            id: new RepairEstimateDetailId(row.repairDetail.id),
            targetProductId: new ProductId(row.repairDetail.targetProductId),
            faultDescription: new FaultDescription(row.repairDetail.faultDescription),
            scheduledRepairDate: row.repairDetail.scheduledRepairDate,
            createdAt: row.repairDetail.createdAt,
            updatedAt: row.repairDetail.updatedAt,
          })
        : null,
      afterRepairDetail: row.afterRepairDetail
        ? AfterRepairEstimateDetail.reconstruct({
            id: new AfterRepairEstimateDetailId(row.afterRepairDetail.id),
            targetProductId: new ProductId(row.afterRepairDetail.targetProductId),
            faultDescription: new FaultDescription(row.afterRepairDetail.faultDescription),
            actualRepairDate: row.afterRepairDetail.actualRepairDate,
            emergencyReason: new EmergencyReason(row.afterRepairDetail.emergencyReason),
            afterServiceWarningAcknowledged: row.afterRepairDetail.afterServiceWarningAcknowledged,
            createdAt: row.afterRepairDetail.createdAt,
            updatedAt: row.afterRepairDetail.updatedAt,
          })
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private static variationToDomain(v: PrismaVariationFull): EstimateVariation {
    return EstimateVariation.reconstruct({
      id: new EstimateVariationId(v.id),
      variationNumber: v.variationNumber,
      status: VariationStatus.from(v.status),
      customerMemo: v.customerMemo,
      internalMemo: v.internalMemo,
      overallDiscount: decimalToMoney(v.overallDiscount),
      items: v.items.map((i) => EstimateMapper.itemToDomain(i)),
      subtotal: decimalToMoney(v.subtotal),
      discountSubtotal: decimalToMoney(v.discountSubtotal),
      finalSubtotal: decimalToMoney(v.finalSubtotal),
      taxAmount: decimalToMoney(v.taxAmount),
      finalTotal: decimalToMoney(v.finalTotal),
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    });
  }

  private static itemToDomain(i: PrismaItemFull): EstimateItem {
    return EstimateItem.reconstruct({
      id: new EstimateItemId(i.id),
      productId: new ProductId(i.productId),
      sortOrder: i.sortOrder,
      itemName: new ItemName(i.itemName),
      quantity: new Quantity(i.quantity),
      unit: new Unit(i.unit),
      unitPrice: decimalToMoney(i.unitPrice),
      discountRate: new DiscountRate(Number(i.discountRate)),
      itemDiscount: decimalToMoney(i.itemDiscount),
      customerMemo: i.customerMemo ? new Memo(i.customerMemo) : null,
      internalMemo: i.internalMemo ? new Memo(i.internalMemo) : null,
      revisedDetail: i.revisedDetail
        ? RevisedEstimateItemDetail.reconstruct(
            new RevisedEstimateItemDetailId(i.revisedDetail.id),
            decimalToMoney(i.revisedDetail.deliveryPrice),
            i.revisedDetail.createdAt,
            i.revisedDetail.updatedAt
          )
        : null,
      baseAmount: decimalToMoney(i.baseAmount),
      discountedAmount: decimalToMoney(i.discountedAmount),
      finalAmount: decimalToMoney(i.finalAmount),
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    });
  }

  // ========================================
  // scalar データビルダー（create / update で共有。列マッピングの単一情報源）
  // タイムスタンプは DB 管理（@default(now()) / @updatedAt）に委ねるため含めない。
  // ========================================

  static toEstimateScalarData(e: Estimate) {
    return {
      estimateNumber: e.estimateNumber.value,
      estimateType: e.estimateType.value as PrismaEstimateType,
      fiscalYear: e.fiscalYear.value,
      sequence: e.sequence,
      estimateDate: e.estimateDate,
      deadline: e.deadline,
      submissionType: e.submissionType.value as PrismaSubmissionType,
      customerId: e.customerId.value,
      deliveryLocationId: e.deliveryLocationId.value,
      taxRate: new Prisma.Decimal(e.taxRate.value),
      taxRoundingType: e.taxRoundingType.value as PrismaTaxRoundingType,
      createdBy: e.createdBy.value,
      departmentId: e.departmentId.value,
    };
  }

  static toVariationScalarData(v: Readonly<EstimateVariation>) {
    return {
      variationNumber: v.variationNumber,
      status: v.status.value as PrismaVariationStatus,
      customerMemo: v.customerMemo,
      internalMemo: v.internalMemo,
      overallDiscount: moneyToDecimal(v.overallDiscount),
      subtotal: moneyToDecimal(v.subtotal),
      discountSubtotal: moneyToDecimal(v.discountSubtotal),
      finalSubtotal: moneyToDecimal(v.finalSubtotal),
      taxAmount: moneyToDecimal(v.taxAmount),
      finalTotal: moneyToDecimal(v.finalTotal),
    };
  }

  static toItemScalarData(i: Readonly<EstimateItem>) {
    return {
      sortOrder: i.sortOrder,
      productId: i.productId.value,
      itemName: i.itemName.value,
      quantity: i.quantity.value,
      unit: i.unit.value,
      unitPrice: moneyToDecimal(i.unitPrice),
      customerMemo: i.customerMemo?.value ?? null,
      internalMemo: i.internalMemo?.value ?? null,
      discountRate: new Prisma.Decimal(i.discountRate.value),
      itemDiscount: moneyToDecimal(i.itemDiscount),
      baseAmount: moneyToDecimal(i.baseAmount),
      discountedAmount: moneyToDecimal(i.discountedAmount),
      finalAmount: moneyToDecimal(i.finalAmount),
    };
  }

  static toRevisedDetailScalarData(d: Readonly<RevisedEstimateItemDetail>) {
    return {
      deliveryPrice: moneyToDecimal(d.deliveryPrice),
    };
  }

  static toRepairDetailScalarData(d: Readonly<RepairEstimateDetail>) {
    return {
      targetProductId: d.targetProductId.value,
      faultDescription: d.faultDescription.value,
      scheduledRepairDate: d.scheduledRepairDate,
    };
  }

  static toAfterRepairDetailScalarData(d: Readonly<AfterRepairEstimateDetail>) {
    return {
      targetProductId: d.targetProductId.value,
      faultDescription: d.faultDescription.value,
      actualRepairDate: d.actualRepairDate,
      emergencyReason: d.emergencyReason.value,
      afterServiceWarningAcknowledged: d.afterServiceWarningAcknowledged,
    };
  }

  // ========================================
  // create パス（単一ネスト create。任意深さで原子的）
  // ========================================

  static toEstimateCreateInput(e: Estimate): Prisma.EstimateUncheckedCreateInput {
    return {
      id: e.id.value,
      ...EstimateMapper.toEstimateScalarData(e),
      variations: {
        create: e.variations.map((v) => ({
          id: v.id.value,
          ...EstimateMapper.toVariationScalarData(v),
          items: {
            create: v.items.map((i) => ({
              id: i.id.value,
              ...EstimateMapper.toItemScalarData(i),
              revisedDetail: i.revisedDetail
                ? {
                    create: {
                      id: i.revisedDetail.id.value,
                      ...EstimateMapper.toRevisedDetailScalarData(i.revisedDetail),
                    },
                  }
                : undefined,
            })),
          },
        })),
      },
      repairDetail: e.repairDetail
        ? {
            create: {
              id: e.repairDetail.id.value,
              ...EstimateMapper.toRepairDetailScalarData(e.repairDetail),
            },
          }
        : undefined,
      afterRepairDetail: e.afterRepairDetail
        ? {
            create: {
              id: e.afterRepairDetail.id.value,
              ...EstimateMapper.toAfterRepairDetailScalarData(e.afterRepairDetail),
            },
          }
        : undefined,
    };
  }
}
