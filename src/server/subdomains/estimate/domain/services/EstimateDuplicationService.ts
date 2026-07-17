import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import {
  Estimate,
  EstimateFactory,
  type AfterRepairDetailDescriptor,
  type CopiedItemDescriptor,
  type CopiedVariationDescriptor,
  type SetGroupDescriptor,
  type RepairDetailDescriptor,
} from "../entities";
import { EstimateNumber } from "../values/EstimateNumber";
import { EstimateVariationId } from "../values/EstimateVariationId";
import { Money } from "@server/shared/domain/values/Money";
import { SubmissionType } from "../values/SubmissionType";
import { TaxRate } from "../values/TaxRate";

/**
 * 複製先明細の解決済み見積単価。キーは提出区分×商品ID（{@link duplicatedUnitPriceKey}）。
 *
 * 1つの複製元でもバリエーションごとに提出区分（得意先宛/納品先宛）が異なりうるため、
 * 商品IDだけでは単価が一意にならない（不変則 単価=f(宛先,商品,年月日)）。アプリ層が価格決定で
 * 構築し {@link EstimateDuplicationService.duplicate} に渡す。ドメインは解決済み `Money` を引くだけで
 * pricing を import しない（DDD レイヤ規約）。
 */
export type DuplicatedUnitPriceMap = ReadonlyMap<string, Money>;

/** {@link DuplicatedUnitPriceMap} のキー生成。アプリ層の構築とドメインの参照で共有する。 */
export function duplicatedUnitPriceKey(submissionType: SubmissionType, productId: string): string {
  return `${submissionType.value}:${productId}`;
}

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
  /**
   * 複製先明細の解決済み見積単価（提出区分×商品ID → Money）。複製先の見積年月日・複製元の宛先・
   * 各バリエーションの提出区分で価格決定した結果をアプリ層が構築して渡す（#431・ADR-20260710-q7t）。
   */
  resolvedUnitPrices: DuplicatedUnitPriceMap;
};

/** 複製の結果（新集約と系譜）。系譜は集約外の兄弟成果物（ADR-0040）。 */
export type EstimateDuplicationResult = ReturnType<typeof EstimateFactory.duplicate>;

/** 集約境界を越えず複製元の子型を参照するためのインデックスアクセス型。 */
type SourceVariation = Estimate["variations"][number];

/**
 * 見積複製の横断ドメインサービス（C6 / 設計書 §5）。
 *
 * 複製元（読み取り）から、選択バリエーションを「単価再解決・固定値引クリア・率継承・
 * 連番振り直し・品目/数量/メモ複写・セット群の群ごと複写（ADR-20260714-k2m）」で記述子化し、
 * 複製時更新項目と継承項目を合成して
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
        index + 1,
        input.resolvedUnitPrices
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
   * - 単価 = 複製先条件で解決済みの見積単価をマップから引く（#431。従来の Money.zero() クリアを撤去し、
   *   不変則 単価=f(宛先,商品,年月日) を回復）。固定値引（itemDiscount / overallDiscount）は付与しない（クリア）。
   * - 率（discountRate）は継承する。
   * - 品目・数量・単位・メモは複写。variationNumber は複製先で連番に振り直す。
   * - セット群は群ごとスナップショット複写する（ADR-20260714-k2m・#602。セット商品マスタから
   *   再展開しない）。構成明細は通常明細と同型の価格付き末端行（ADR-0047）なので同じ変換規則を
   *   適用し、群の入れ子 `components` に積む（id 配線は EstimateFactory.buildSetGroups が行う）。
   * - status は記述子に持たせず、ファクトリ既定の ACTIVE になる（すべて有効 / §5.3）。
   */
  private static toCopiedDescriptor(
    source: SourceVariation,
    variationNumber: number,
    resolvedUnitPrices: DuplicatedUnitPriceMap
  ): CopiedVariationDescriptor {
    // 平坦な items（通常明細＋構成明細の同居・ADR-0047）を群の所属で仕分けてから変換する。
    // 素通しすると構成明細がバラの通常明細として複写され、群が消える（#602）。
    const structure = source.lineStructure;
    const copyItem = (item: SourceVariation["items"][number]): CopiedItemDescriptor => ({
      productId: item.productId,
      sortOrder: item.sortOrder,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: EstimateDuplicationService.resolvedUnitPriceOrThrow(
        resolvedUnitPrices,
        source.submissionType,
        item
      ),
      discountRate: item.discountRate,
      customerMemo: item.customerMemo,
      internalMemo: item.internalMemo,
    });

    return {
      variationNumber,
      sourceVariationId: source.id,
      // 提出区分は複製元バリエーション単位で継承する（ADR-0045 / §5.3）
      submissionType: source.submissionType,
      items: structure.normalItems.map(copyItem),
      setGroups: structure.setGroups.map(
        ({ group, components }): SetGroupDescriptor<CopiedItemDescriptor> => ({
          productId: group.productId,
          itemName: group.itemName,
          unit: group.unit,
          // 群自身は価格を持たない（価格保守対象商品ではない）ため単価解決の対象に入れない
          components: components.map(copyItem),
          customerMemo: group.customerMemo,
          internalMemo: group.internalMemo,
        })
      ),
      customerMemo: source.customerMemo,
      internalMemo: source.internalMemo,
    };
  }

  /**
   * 解決済み単価マップから明細の見積単価を引く。欠落は黙って 0 円にせず
   * BusinessRuleViolationError で拒否する（アプリ層が全明細を解決してから渡す前提の防御・#431）。
   */
  private static resolvedUnitPriceOrThrow(
    resolvedUnitPrices: DuplicatedUnitPriceMap,
    submissionType: SubmissionType,
    item: SourceVariation["items"][number]
  ): Money {
    const price = resolvedUnitPrices.get(
      duplicatedUnitPriceKey(submissionType, item.productId.value)
    );
    if (price === undefined) {
      throw new BusinessRuleViolationError(
        `複製先の見積単価が解決されていません（商品=${item.itemName.value}）`
      );
    }
    return price;
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
