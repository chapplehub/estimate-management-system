import type { FiscalYear } from "@server/shared/domain/values/FiscalYear";
import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { DeliveryLocationId } from "@subdomains/delivery-location/domain/values/DeliveryLocationId";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import type { DiscountRate } from "../values/DiscountRate";
import { EstimateId } from "../values/EstimateId";
import type { EstimateItemId } from "../values/EstimateItemId";
import { EstimateNumber } from "../values/EstimateNumber";
import { EstimateType } from "../values/EstimateType";
import type { EstimateVariationId } from "../values/EstimateVariationId";
import type { Money } from "../values/Money";
import type { Quantity } from "../values/Quantity";
import { SubmissionType } from "../values/SubmissionType";
import { TaxRate } from "../values/TaxRate";
import { TaxRoundingType } from "../values/TaxRoundingType";
import type { AfterRepairEstimateDetail } from "./AfterRepairEstimateDetail";
import type { EstimateItem } from "./EstimateItem";
import { EstimateVariation, type TaxContext, type VariationContent } from "./EstimateVariation";
import type { RepairEstimateDetail } from "./RepairEstimateDetail";

/**
 * Estimate 集約ルート（§11.3.1 / ADR-0019）。
 *
 * **集約境界規約**: 本クラスのみ entities バレル (index.ts) から export
 * され、子エンティティ (EstimateVariation / EstimateItem / 修理詳細群) は
 * 集約外から直接インスタンス化・操作できない。集約外からの全状態変更は
 * 本ルートのメソッド経由で行う。
 *
 * **不変条件**:
 * 1. estimateType と詳細テーブルの排他的整合 (ADR-0019):
 *    - NEW          → repairDetail = null かつ afterRepairDetail = null
 *    - REPAIR       → repairDetail != null かつ afterRepairDetail = null
 *    - AFTER_REPAIR → repairDetail = null かつ afterRepairDetail != null
 * 2. 全 EstimateVariation の集計が常に最新（明細変更・税率変更時に自動再計算）
 * 3. 最低 1 バリエーションを持つ（§C1 空見積不可、create() 時の必須条件）
 * 4. variationNumber は重複しない（assertNoVariationNumberDuplication）
 *
 * **§3.4 申請バリエーション制約**: 「1見積につき申請できるバリエーションは1つのみ」は
 * 申請ユースケース (着手順序 #6) で実装する。ドメイン層では複数 ACTIVE を
 * 構造的に禁止しない（バリエーション間で見積比較するワークフローを許容するため）。
 */
export class Estimate {
  static readonly ENTITY_NAME = "見積";

  private constructor(
    private readonly _id: EstimateId,
    private readonly _estimateNumber: EstimateNumber,
    private _estimateDate: Date,
    private _deadline: Date,
    private _customerId: CustomerId,
    private _deliveryLocationId: DeliveryLocationId,
    private _taxRate: TaxRate,
    private _taxRoundingType: TaxRoundingType,
    private readonly _createdBy: EmployeeId,
    private _departmentId: DepartmentId,
    private readonly _variations: EstimateVariation[],
    private _repairDetail: RepairEstimateDetail | null,
    private _afterRepairDetail: AfterRepairEstimateDetail | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  /**
   * 新規見積を作成する。
   *
   * - 最低 1 バリエーションが必須（§C1 空見積不可）。
   * - estimateType と詳細テーブルの整合 (ADR-0019) を検証。
   */
  static create(input: {
    estimateNumber: EstimateNumber;
    estimateDate: Date;
    deadline: Date;
    customerId: CustomerId;
    deliveryLocationId: DeliveryLocationId;
    taxRate: TaxRate;
    taxRoundingType: TaxRoundingType;
    createdBy: EmployeeId;
    departmentId: DepartmentId;
    variations: EstimateVariation[];
    repairDetail?: RepairEstimateDetail | null;
    afterRepairDetail?: AfterRepairEstimateDetail | null;
  }): Estimate {
    if (input.variations.length === 0) {
      throw new BusinessRuleViolationError(
        "見積は最低 1 つのバリエーションを持つ必要があります（§C1 空見積不可）"
      );
    }
    Estimate.assertNoVariationNumberDuplication(input.variations);
    Estimate.assertSubtypeIntegrity(
      input.estimateNumber.estimateType,
      input.repairDetail ?? null,
      input.afterRepairDetail ?? null
    );

    const now = new Date();
    return new Estimate(
      EstimateId.generate(),
      input.estimateNumber,
      input.estimateDate,
      input.deadline,
      input.customerId,
      input.deliveryLocationId,
      input.taxRate,
      input.taxRoundingType,
      input.createdBy,
      input.departmentId,
      input.variations,
      input.repairDetail ?? null,
      input.afterRepairDetail ?? null,
      now,
      now
    );
  }

  /**
   * 永続化値から再構築する。
   *
   * 子の集計値は保存済みのものをそのまま信頼する（再計算しない）。
   * §8 金額の保存形式に従い、見積時点の値を保持するため。
   */
  static reconstruct(input: {
    id: EstimateId;
    estimateNumber: EstimateNumber;
    estimateDate: Date;
    deadline: Date;
    customerId: CustomerId;
    deliveryLocationId: DeliveryLocationId;
    taxRate: TaxRate;
    taxRoundingType: TaxRoundingType;
    createdBy: EmployeeId;
    departmentId: DepartmentId;
    variations: EstimateVariation[];
    repairDetail: RepairEstimateDetail | null;
    afterRepairDetail: AfterRepairEstimateDetail | null;
    createdAt: Date;
    updatedAt: Date;
  }): Estimate {
    return new Estimate(
      input.id,
      input.estimateNumber,
      input.estimateDate,
      input.deadline,
      input.customerId,
      input.deliveryLocationId,
      input.taxRate,
      input.taxRoundingType,
      input.createdBy,
      input.departmentId,
      input.variations,
      input.repairDetail,
      input.afterRepairDetail,
      input.createdAt,
      input.updatedAt
    );
  }

  // ========================================
  // バリエーション操作
  // ========================================

  addVariation(variation: EstimateVariation): void {
    Estimate.assertNoVariationNumberDuplication([...this._variations, variation]);
    this._variations.push(variation);
    this.touch();
  }

  /**
   * 内容を指定して新バリエーションを追加する（C3 AddVariation）。
   *
   * バリエーション番号は集約内で `max(既存)+1` を自動採番する（§A.2 連番採番）。
   * 歯抜け（removeVariation 後）があっても衝突しないよう count+1 ではなく max+1 を用いる。
   * 採番は「集約内の一意性＋連番」という集約不変条件のためドメインに置く。
   */
  appendVariation(content: VariationContent, submissionType: SubmissionType): EstimateVariation {
    const variation = EstimateVariation.create({
      variationNumber: this.nextVariationNumber(),
      submissionType,
      tax: this.taxContext(),
      items: content.items,
      overallDiscount: content.overallDiscount,
      customerMemo: content.customerMemo,
      internalMemo: content.internalMemo,
    });
    this.addVariation(variation);
    return variation;
  }

  /**
   * 指定バリエーションの内容を一括差替えする（C4 UpdateVariation）。
   * §3.4 無効状態の編集不可ガードは EstimateVariation.replaceContent 内で行う。
   * 凍結（改訂元・§7.2）ガードは集約横断の判定のためルートで行う。
   */
  updateVariation(variationId: EstimateVariationId, content: VariationContent): void {
    this.editableVariationOrThrow(variationId).replaceContent(content, this.taxContext());
    this.touch();
  }

  /**
   * バリエーションを削除する。
   *
   * 凍結された改訂元は削除不可（系譜の参照先が消えるため・§7.2）。
   * 逆に改訂先の削除は許可される: 出自（系譜）ごと消えるため、改訂元の凍結が
   * 自動的に解ける（凍結＝系譜からの導出という設計の帰結・ADR-0044）。
   */
  removeVariation(variationId: EstimateVariationId): void {
    if (this._variations.length === 1) {
      throw new BusinessRuleViolationError(
        "最後のバリエーションは削除できません（§C1 空見積不可）"
      );
    }
    if (this.isVariationFrozen(variationId)) {
      throw new BusinessRuleViolationError(
        "凍結された改訂元バリエーションは削除できません（改訂先が存在する間・§7.2）"
      );
    }
    const index = this._variations.findIndex((v) => v.id.equals(variationId));
    if (index === -1) {
      throw new BusinessRuleViolationError(
        `指定されたバリエーションは存在しません: ${variationId.value}`
      );
    }
    this._variations.splice(index, 1);
    this.touch();
  }

  activateVariation(variationId: EstimateVariationId): void {
    this.findVariationOrThrow(variationId).activate();
    this.touch();
  }

  deactivateVariation(variationId: EstimateVariationId): void {
    this.findVariationOrThrow(variationId).deactivate();
    this.touch();
  }

  // ========================================
  // 明細操作（集約境界規約 → 集約ルートが唯一の入口）
  // ========================================

  addItem(variationId: EstimateVariationId, item: EstimateItem): void {
    this.editableVariationOrThrow(variationId).addItem(item, this.taxContext());
    this.touch();
  }

  removeItem(variationId: EstimateVariationId, itemId: EstimateItemId): void {
    this.editableVariationOrThrow(variationId).removeItem(itemId, this.taxContext());
    this.touch();
  }

  changeItemQuantity(
    variationId: EstimateVariationId,
    itemId: EstimateItemId,
    newQuantity: Quantity
  ): void {
    this.editableVariationOrThrow(variationId).changeItemQuantity(
      itemId,
      newQuantity,
      this.taxContext()
    );
    this.touch();
  }

  changeItemUnitPrice(
    variationId: EstimateVariationId,
    itemId: EstimateItemId,
    newPrice: Money
  ): void {
    this.editableVariationOrThrow(variationId).changeItemUnitPrice(
      itemId,
      newPrice,
      this.taxContext()
    );
    this.touch();
  }

  changeItemDiscountRate(
    variationId: EstimateVariationId,
    itemId: EstimateItemId,
    newRate: DiscountRate
  ): void {
    this.editableVariationOrThrow(variationId).changeItemDiscountRate(
      itemId,
      newRate,
      this.taxContext()
    );
    this.touch();
  }

  changeItemDiscount(
    variationId: EstimateVariationId,
    itemId: EstimateItemId,
    newDiscount: Money
  ): void {
    this.editableVariationOrThrow(variationId).changeItemDiscount(
      itemId,
      newDiscount,
      this.taxContext()
    );
    this.touch();
  }

  changeOverallDiscount(variationId: EstimateVariationId, newDiscount: Money): void {
    this.editableVariationOrThrow(variationId).changeOverallDiscount(
      newDiscount,
      this.taxContext()
    );
    this.touch();
  }

  // ========================================
  // 税情報変更（全 Variation に伝播）
  // ========================================

  changeTaxRate(newRate: TaxRate): void {
    this._taxRate = newRate;
    this.propagateTaxToAllVariations();
  }

  changeTaxRoundingType(newType: TaxRoundingType): void {
    this._taxRoundingType = newType;
    this.propagateTaxToAllVariations();
  }

  // ========================================
  // サブタイプ詳細の付け替え（ADR-0019 整合チェック）
  // ========================================

  attachRepairDetail(detail: RepairEstimateDetail): void {
    if (!this.estimateType.equals(EstimateType.REPAIR)) {
      throw new BusinessRuleViolationError(
        `事前修理見積詳細は estimateType=REPAIR の見積にしか付与できません（現在: ${this.estimateType.value}）`
      );
    }
    if (this._afterRepairDetail !== null) {
      throw new BusinessRuleViolationError(
        "事後修理見積詳細が既に付与されているため、事前修理見積詳細は付与できません"
      );
    }
    this._repairDetail = detail;
    this.touch();
  }

  detachRepairDetail(): void {
    if (this.estimateType.equals(EstimateType.REPAIR)) {
      throw new BusinessRuleViolationError(
        "estimateType=REPAIR の見積では事前修理見積詳細を外せません（ADR-0019）"
      );
    }
    this._repairDetail = null;
    this.touch();
  }

  attachAfterRepairDetail(detail: AfterRepairEstimateDetail): void {
    if (!this.estimateType.equals(EstimateType.AFTER_REPAIR)) {
      throw new BusinessRuleViolationError(
        `事後修理見積詳細は estimateType=AFTER_REPAIR の見積にしか付与できません（現在: ${this.estimateType.value}）`
      );
    }
    if (this._repairDetail !== null) {
      throw new BusinessRuleViolationError(
        "事前修理見積詳細が既に付与されているため、事後修理見積詳細は付与できません"
      );
    }
    this._afterRepairDetail = detail;
    this.touch();
  }

  detachAfterRepairDetail(): void {
    if (this.estimateType.equals(EstimateType.AFTER_REPAIR)) {
      throw new BusinessRuleViolationError(
        "estimateType=AFTER_REPAIR の見積では事後修理見積詳細を外せません（ADR-0019）"
      );
    }
    this._afterRepairDetail = null;
    this.touch();
  }

  // ========================================
  // メタ情報変更
  // ========================================

  changeEstimateDate(newDate: Date): void {
    this._estimateDate = newDate;
    this.touch();
  }

  changeDeadline(newDeadline: Date): void {
    this._deadline = newDeadline;
    this.touch();
  }

  changeCustomer(newCustomerId: CustomerId): void {
    this._customerId = newCustomerId;
    this.touch();
  }

  changeDeliveryLocation(newId: DeliveryLocationId): void {
    this._deliveryLocationId = newId;
    this.touch();
  }

  changeDepartment(newId: DepartmentId): void {
    this._departmentId = newId;
    this.touch();
  }

  // ========================================
  // 内部ヘルパ
  // ========================================

  private taxContext(): TaxContext {
    return { taxRate: this._taxRate, taxRoundingType: this._taxRoundingType };
  }

  private propagateTaxToAllVariations(): void {
    const ctx = this.taxContext();
    for (const v of this._variations) {
      v.recalculateForTaxChange(ctx);
    }
    this.touch();
  }

  /** §A.2: バリエーション番号は max(既存)+1 で連番採番。空なら 1 始まり。 */
  private nextVariationNumber(): number {
    if (this._variations.length === 0) {
      return 1;
    }
    return Math.max(...this._variations.map((v) => v.variationNumber)) + 1;
  }

  /**
   * 凍結判定（ADR-0044）: 「集約内に、自分を改訂元（revisedFrom）とするバリエーションが
   * 存在する ⟺ 凍結」。凍結は改訂された事実（系譜）からの導出であり、保存された状態ではない。
   * 他バリエーションの出自を横断して見る必要があるため、判定は集約ルートにしか置けない。
   */
  private isVariationFrozen(variationId: EstimateVariationId): boolean {
    return this._variations.some((v) => v.revisedFrom?.equals(variationId) ?? false);
  }

  /** 凍結（§7.2）: 改訂元はメモ・ステータス以外の編集と削除を拒否する。 */
  private assertVariationNotFrozen(variationId: EstimateVariationId): void {
    if (this.isVariationFrozen(variationId)) {
      throw new BusinessRuleViolationError(
        "改訂元バリエーションは凍結されています。メモ以外は編集できません（§7.2）"
      );
    }
  }

  /**
   * 内容編集系の入口（C4 差替え・明細操作・全体値引）が使う取得ヘルパ。
   * 凍結（改訂元）を拒否してから返す。ステータス変更（activate/deactivate）と
   * メモ変更は凍結中も許可されるため findVariationOrThrow を直接使う。
   */
  private editableVariationOrThrow(variationId: EstimateVariationId): EstimateVariation {
    this.assertVariationNotFrozen(variationId);
    return this.findVariationOrThrow(variationId);
  }

  private findVariationOrThrow(variationId: EstimateVariationId): EstimateVariation {
    const v = this._variations.find((x) => x.id.equals(variationId));
    if (!v) {
      throw new BusinessRuleViolationError(
        `指定されたバリエーションは存在しません: ${variationId.value}`
      );
    }
    return v;
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static assertNoVariationNumberDuplication(
    variations: ReadonlyArray<EstimateVariation>
  ): void {
    const seen = new Set<number>();
    for (const v of variations) {
      if (seen.has(v.variationNumber)) {
        throw new ValidationError(`バリエーション番号が重複しています: ${v.variationNumber}`);
      }
      seen.add(v.variationNumber);
    }
  }

  private static assertSubtypeIntegrity(
    estimateType: EstimateType,
    repairDetail: RepairEstimateDetail | null,
    afterRepairDetail: AfterRepairEstimateDetail | null
  ): void {
    if (estimateType.equals(EstimateType.NEW)) {
      if (repairDetail !== null || afterRepairDetail !== null) {
        throw new BusinessRuleViolationError(
          "estimateType=NEW の見積は修理関連詳細を持てません（ADR-0019）"
        );
      }
      return;
    }
    if (estimateType.equals(EstimateType.REPAIR)) {
      if (repairDetail === null) {
        throw new BusinessRuleViolationError(
          "estimateType=REPAIR の見積は事前修理見積詳細が必須です（ADR-0019）"
        );
      }
      if (afterRepairDetail !== null) {
        throw new BusinessRuleViolationError(
          "estimateType=REPAIR の見積は事後修理見積詳細を持てません（ADR-0019）"
        );
      }
      return;
    }
    if (estimateType.equals(EstimateType.AFTER_REPAIR)) {
      if (afterRepairDetail === null) {
        throw new BusinessRuleViolationError(
          "estimateType=AFTER_REPAIR の見積は事後修理見積詳細が必須です（ADR-0019）"
        );
      }
      if (repairDetail !== null) {
        throw new BusinessRuleViolationError(
          "estimateType=AFTER_REPAIR の見積は事前修理見積詳細を持てません（ADR-0019）"
        );
      }
    }
  }

  // ========================================
  // ゲッター
  // ========================================

  get id(): EstimateId {
    return this._id;
  }

  get estimateNumber(): EstimateNumber {
    return this._estimateNumber;
  }

  /** EstimateNumber から派生。永続化スキーマでは別カラムだがドメインでは派生値。 */
  get estimateType(): EstimateType {
    return this._estimateNumber.estimateType;
  }

  /** EstimateNumber から派生。 */
  get fiscalYear(): FiscalYear {
    return this._estimateNumber.fiscalYear;
  }

  /** EstimateNumber から派生。 */
  get sequence(): number {
    return this._estimateNumber.sequence;
  }

  get estimateDate(): Date {
    return this._estimateDate;
  }

  get deadline(): Date {
    return this._deadline;
  }

  get customerId(): CustomerId {
    return this._customerId;
  }

  get deliveryLocationId(): DeliveryLocationId {
    return this._deliveryLocationId;
  }

  get taxRate(): TaxRate {
    return this._taxRate;
  }

  get taxRoundingType(): TaxRoundingType {
    return this._taxRoundingType;
  }

  get createdBy(): EmployeeId {
    return this._createdBy;
  }

  get departmentId(): DepartmentId {
    return this._departmentId;
  }

  get variations(): ReadonlyArray<Readonly<EstimateVariation>> {
    return this._variations;
  }

  get repairDetail(): RepairEstimateDetail | null {
    return this._repairDetail;
  }

  get afterRepairDetail(): AfterRepairEstimateDetail | null {
    return this._afterRepairDetail;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
