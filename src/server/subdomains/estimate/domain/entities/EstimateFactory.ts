import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import type { DiscountRate } from "../values/DiscountRate";
import { EmergencyReason } from "../values/EmergencyReason";
import { EstimateNumber } from "../values/EstimateNumber";
import { FaultDescription } from "../values/FaultDescription";
import { ItemName } from "../values/ItemName";
import { Memo } from "../values/Memo";
import { Money } from "../values/Money";
import { Quantity } from "../values/Quantity";
import { SubmissionType } from "../values/SubmissionType";
import { TaxRate } from "../values/TaxRate";
import { TaxRoundingType } from "../values/TaxRoundingType";
import { Unit } from "../values/Unit";
import { AfterRepairEstimateDetail } from "./AfterRepairEstimateDetail";
import { Estimate } from "./Estimate";
import { EstimateItem } from "./EstimateItem";
import { EstimateVariation, type TaxContext, type VariationContent } from "./EstimateVariation";
import { RepairEstimateDetail } from "./RepairEstimateDetail";
import { RevisedEstimateItemDetail } from "./RevisedEstimateItemDetail";

/**
 * 集約外（アプリ層）から見積集約を生成するためのドメインファクトリ。
 *
 * **配置理由（集約境界規約）**: 子エンティティ（EstimateVariation / EstimateItem /
 * 修理詳細群 / 改訂明細詳細）の構築は集約内からのみ許される（eslint
 * no-restricted-imports）。アプリ層コマンドはこれら子を直接 new できないため、
 * 「子の組み立て」という集約内責務を本ファクトリに閉じ込め、コマンドへは
 * 値オブジェクトで構成した記述子（descriptor）を受け渡す。
 *
 * 入力は値オブジェクト止まりの記述子とする（primitive → VO 変換はアプリ層コマンドが
 * 既存規約どおり担当）。本ファクトリは「VO 記述子 → 子エンティティ → 集約ルート」の
 * 組み立てのみを責務とし、子エンティティ型を一切外部へ露出しない。
 */

/** 明細の記述子（値オブジェクト止まり。改訂明細詳細は納品価格 VO から本ファクトリが構築）。 */
export type EstimateItemDescriptor = {
  productId: ProductId;
  sortOrder: number;
  itemName: ItemName;
  quantity: Quantity;
  unit: Unit;
  unitPrice: Money;
  discountRate?: DiscountRate;
  itemDiscount?: Money;
  customerMemo?: Memo;
  internalMemo?: Memo;
  /** 得意先改訂で生まれた明細のみ持つ納品価格。指定時のみ改訂明細詳細を構築する。 */
  revisedDeliveryPrice?: Money | null;
};

/** バリエーションの記述子（値オブジェクト止まり）。 */
export type EstimateVariationDescriptor = {
  variationNumber: number;
  items: EstimateItemDescriptor[];
  overallDiscount?: Money;
  customerMemo?: Memo;
  internalMemo?: Memo;
};

/**
 * 番号を含まないバリエーション内容の記述子。C3 AddVariation（番号は集約が採番）と
 * C4 UpdateVariation（番号は変更しない）で共用する。
 */
export type VariationContentDescriptor = Omit<EstimateVariationDescriptor, "variationNumber">;

/** 修理見積（事前）サブタイプ詳細の記述子。 */
export type RepairDetailDescriptor = {
  targetProductId: ProductId;
  faultDescription: FaultDescription;
  scheduledRepairDate: Date;
};

/** 事後修理見積サブタイプ詳細の記述子。 */
export type AfterRepairDetailDescriptor = {
  targetProductId: ProductId;
  faultDescription: FaultDescription;
  actualRepairDate: Date;
  emergencyReason: EmergencyReason;
};

/** 見積集約生成の入力（すべて値オブジェクト／記述子で構成）。 */
export type EstimateFactoryInput = {
  estimateNumber: EstimateNumber;
  estimateDate: Date;
  deadline: Date;
  submissionType: SubmissionType;
  customerId: CustomerId;
  deliveryLocationId: DeliveryLocationId;
  taxRate: TaxRate;
  taxRoundingType: TaxRoundingType;
  createdBy: EmployeeId;
  departmentId: DepartmentId;
  variations: EstimateVariationDescriptor[];
  repairDetail?: RepairDetailDescriptor | null;
  afterRepairDetail?: AfterRepairDetailDescriptor | null;
};

export class EstimateFactory {
  /**
   * VO 記述子から子エンティティを組み立て、集約ルート Estimate を生成する。
   *
   * 空見積不可・variationNumber 重複・estimateType とサブタイプ詳細の整合
   * （ADR-0019）は Estimate.create() が担保するため、本ファクトリは追加検証を行わない。
   */
  static create(input: EstimateFactoryInput): Estimate {
    const tax: TaxContext = {
      taxRate: input.taxRate,
      taxRoundingType: input.taxRoundingType,
    };

    const variations = input.variations.map((variation) =>
      EstimateFactory.buildVariation(variation, tax)
    );

    return Estimate.create({
      estimateNumber: input.estimateNumber,
      estimateDate: input.estimateDate,
      deadline: input.deadline,
      submissionType: input.submissionType,
      customerId: input.customerId,
      deliveryLocationId: input.deliveryLocationId,
      taxRate: input.taxRate,
      taxRoundingType: input.taxRoundingType,
      createdBy: input.createdBy,
      departmentId: input.departmentId,
      variations,
      repairDetail: input.repairDetail
        ? RepairEstimateDetail.create({
            targetProductId: input.repairDetail.targetProductId,
            faultDescription: input.repairDetail.faultDescription,
            scheduledRepairDate: input.repairDetail.scheduledRepairDate,
          })
        : null,
      afterRepairDetail: input.afterRepairDetail
        ? AfterRepairEstimateDetail.create({
            targetProductId: input.afterRepairDetail.targetProductId,
            faultDescription: input.afterRepairDetail.faultDescription,
            actualRepairDate: input.afterRepairDetail.actualRepairDate,
            emergencyReason: input.afterRepairDetail.emergencyReason,
          })
        : null,
    });
  }

  /**
   * 番号なしのバリエーション内容から、構築済み子明細を含む VariationContent を生成する。
   * C3 AddVariation / C4 UpdateVariation がアプリ層から子 EstimateItem を直接 new せずに
   * 内容を組み立てるための入口（集約境界規約）。採番・差替えは集約ルートの責務。
   */
  static buildVariationContent(content: VariationContentDescriptor): VariationContent {
    return {
      items: content.items.map((item) => EstimateFactory.buildItem(item)),
      overallDiscount: content.overallDiscount,
      customerMemo: content.customerMemo,
      internalMemo: content.internalMemo,
    };
  }

  private static buildVariation(
    variation: EstimateVariationDescriptor,
    tax: TaxContext
  ): EstimateVariation {
    const items = variation.items.map((item) => EstimateFactory.buildItem(item));
    return EstimateVariation.create({
      variationNumber: variation.variationNumber,
      tax,
      items,
      overallDiscount: variation.overallDiscount,
      customerMemo: variation.customerMemo,
      internalMemo: variation.internalMemo,
    });
  }

  private static buildItem(item: EstimateItemDescriptor): EstimateItem {
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
}
