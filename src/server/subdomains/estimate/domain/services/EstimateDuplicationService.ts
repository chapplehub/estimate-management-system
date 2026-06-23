import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import {
  Estimate,
  EstimateFactory,
  type AfterRepairDetailDescriptor,
  type CopiedVariationDescriptor,
  type RepairDetailDescriptor,
} from "../entities";
import { EstimateNumber } from "../values/EstimateNumber";
import { EstimateVariationId } from "../values/EstimateVariationId";
import { Money } from "@server/shared/domain/values/Money";
import { TaxRate } from "../values/TaxRate";

/**
 * 見積複製の入力。
 *
 * 複製元集約（読み取り専用）と選択バリエーション（選択順 = 複製順）に加え、
 * 複製時に更新される項目（採番済み番号・日付・税率・作成者・部署）をアプリ層から受け取る。
 * 得意先・納品先・税端数区分・修理詳細は複製元から継承する（§5.3）。
 * 提出区分は複製元バリエーション単位で継承する（ADR-0045）。
 */
export type EstimateDuplicationInput = {
  source: Estimate;
  /** 複製するバリエーション（選択順を保持し、複製先で連番に振り直す）。 */
  selectedVariationIds: EstimateVariationId[];
  estimateNumber: EstimateNumber;
  estimateDate: Date;
  deadline: Date;
  taxRate: TaxRate;
  createdBy: EmployeeId;
  departmentId: DepartmentId;
};

/** 複製の結果（新集約と系譜）。系譜は集約外の兄弟成果物（ADR-0040）。 */
export type EstimateDuplicationResult = ReturnType<typeof EstimateFactory.duplicate>;

/** 集約境界を越えず複製元の子型を参照するためのインデックスアクセス型。 */
type SourceVariation = Estimate["variations"][number];

/**
 * 見積複製の横断ドメインサービス（C6 / 設計書 §5）。
 *
 * 複製元（読み取り）から、選択バリエーションを「単価クリア・固定値引クリア・率継承・
 * 連番振り直し・品目/数量/メモ複写」で記述子化し、複製時更新項目と継承項目を合成して
 * EstimateFactory.duplicate に渡す。子エンティティの構築と系譜のペア化はファクトリの責務
 * （集約境界規約 / ADR-0027・0036）。複製元は一切変更しない。
 *
 * 不変条件（空見積不可 / §C1・ADR-0042）として最低 1 バリエーションの選択を要求する。
 */
export class EstimateDuplicationService {
  private constructor() {}

  static duplicate(input: EstimateDuplicationInput): EstimateDuplicationResult {
    if (input.selectedVariationIds.length === 0) {
      throw new BusinessRuleViolationError(
        "複製するバリエーションを 1 つ以上選択してください（§C1 空見積不可・ADR-0042）"
      );
    }

    const variations = input.selectedVariationIds.map((id, index) =>
      EstimateDuplicationService.toCopiedDescriptor(
        EstimateDuplicationService.resolveVariation(input.source, id),
        index + 1
      )
    );

    return EstimateFactory.duplicate({
      estimateNumber: input.estimateNumber,
      estimateDate: input.estimateDate,
      deadline: input.deadline,
      // 継承（複製元。提出区分はバリエーション単位で toCopiedDescriptor が継承する）
      customerId: input.source.customerId,
      deliveryLocationId: input.source.deliveryLocationId,
      taxRoundingType: input.source.taxRoundingType,
      // 更新（アプリ供給）
      taxRate: input.taxRate,
      createdBy: input.createdBy,
      departmentId: input.departmentId,
      variations,
      repairDetail: EstimateDuplicationService.copyRepairDetail(input.source.repairDetail),
      afterRepairDetail: EstimateDuplicationService.copyAfterRepairDetail(
        input.source.afterRepairDetail
      ),
    });
  }

  private static resolveVariation(source: Estimate, id: EstimateVariationId): SourceVariation {
    const found = source.variations.find((variation) => variation.id.equals(id));
    if (!found) {
      throw new BusinessRuleViolationError(
        `複製元に存在しないバリエーションが選択されました（id=${id.value}）`
      );
    }
    return found;
  }

  /**
   * 複製先バリエーションの記述子を作る。
   * - 単価 = 0 にクリア（要入力）。固定値引（itemDiscount / overallDiscount）は付与しない（クリア）。
   * - 率（discountRate）は継承（単価0でも負数にならず、後の単価入力時に効く）。
   * - 品目・数量・単位・メモは複写。variationNumber は複製先で連番に振り直す。
   * - status は記述子に持たせず、ファクトリ既定の ACTIVE になる（すべて有効 / §5.3）。
   */
  private static toCopiedDescriptor(
    source: SourceVariation,
    variationNumber: number
  ): CopiedVariationDescriptor {
    return {
      variationNumber,
      sourceVariationId: source.id,
      // 提出区分は複製元バリエーション単位で継承する（ADR-0045 / §5.3）
      submissionType: source.submissionType,
      items: source.items.map((item) => ({
        productId: item.productId,
        sortOrder: item.sortOrder,
        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: Money.zero(),
        discountRate: item.discountRate,
        customerMemo: item.customerMemo,
        internalMemo: item.internalMemo,
      })),
      customerMemo: source.customerMemo,
      internalMemo: source.internalMemo,
    };
  }

  private static copyRepairDetail(detail: Estimate["repairDetail"]): RepairDetailDescriptor | null {
    if (!detail) {
      return null;
    }
    return {
      targetProductId: detail.targetProductId,
      faultDescription: detail.faultDescription,
      scheduledRepairDate: detail.scheduledRepairDate,
    };
  }

  private static copyAfterRepairDetail(
    detail: Estimate["afterRepairDetail"]
  ): AfterRepairDetailDescriptor | null {
    if (!detail) {
      return null;
    }
    return {
      targetProductId: detail.targetProductId,
      faultDescription: detail.faultDescription,
      actualRepairDate: detail.actualRepairDate,
      emergencyReason: detail.emergencyReason,
    };
  }
}
