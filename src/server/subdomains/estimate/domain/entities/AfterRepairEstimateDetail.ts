import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { AfterRepairEstimateDetailId } from "../values/AfterRepairEstimateDetailId";
import { EmergencyReason } from "../values/EmergencyReason";
import { FaultDescription } from "../values/FaultDescription";

/**
 * 事後修理見積詳細エンティティ（§6.3, §11.3.1）。
 *
 * estimateType = AFTER_REPAIR の Estimate に 1:1 で付随する子エンティティ。
 * 修理実施後に作成される見積のため `actualRepairDate`（過去日）と
 * `emergencyReason`（緊急対応理由）を必須で持つ。
 *
 * §6.3 の「10万円超警告の確認」フラグを `acknowledgeWarning()` 遷移で
 * 持ち上げる。フラグは false → true への単方向遷移のみ許可する（誤って
 * 取り下げて警告未確認状態に戻ることを防ぐため）。
 *
 * Estimate 集約の内部子エンティティ。バレル (entities/index.ts) からは
 * export せず、集約外からの直接インスタンス化を構造的に禁止する。
 */
export class AfterRepairEstimateDetail {
  static readonly ENTITY_NAME = "事後修理見積詳細";

  private constructor(
    private readonly _id: AfterRepairEstimateDetailId,
    private _targetProductId: ProductId,
    private _faultDescription: FaultDescription,
    private _actualRepairDate: Date,
    private _emergencyReason: EmergencyReason,
    private _afterServiceWarningAcknowledged: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  static create(input: {
    targetProductId: ProductId;
    faultDescription: FaultDescription;
    actualRepairDate: Date;
    emergencyReason: EmergencyReason;
  }): AfterRepairEstimateDetail {
    const now = new Date();
    return new AfterRepairEstimateDetail(
      AfterRepairEstimateDetailId.generate(),
      input.targetProductId,
      input.faultDescription,
      input.actualRepairDate,
      input.emergencyReason,
      false,
      now,
      now
    );
  }

  static reconstruct(input: {
    id: AfterRepairEstimateDetailId;
    targetProductId: ProductId;
    faultDescription: FaultDescription;
    actualRepairDate: Date;
    emergencyReason: EmergencyReason;
    afterServiceWarningAcknowledged: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AfterRepairEstimateDetail {
    return new AfterRepairEstimateDetail(
      input.id,
      input.targetProductId,
      input.faultDescription,
      input.actualRepairDate,
      input.emergencyReason,
      input.afterServiceWarningAcknowledged,
      input.createdAt,
      input.updatedAt
    );
  }

  changeTargetProduct(newProductId: ProductId): void {
    this._targetProductId = newProductId;
    this.touch();
  }

  changeFaultDescription(newDescription: FaultDescription): void {
    this._faultDescription = newDescription;
    this.touch();
  }

  changeActualRepairDate(newDate: Date): void {
    this._actualRepairDate = newDate;
    this.touch();
  }

  changeEmergencyReason(newReason: EmergencyReason): void {
    this._emergencyReason = newReason;
    this.touch();
  }

  /**
   * §6.3 10万円超警告を確認済みにする。単方向遷移（false → true）のみ許可。
   */
  acknowledgeWarning(): void {
    this._afterServiceWarningAcknowledged = true;
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  get id(): AfterRepairEstimateDetailId {
    return this._id;
  }

  get targetProductId(): ProductId {
    return this._targetProductId;
  }

  get faultDescription(): FaultDescription {
    return this._faultDescription;
  }

  get actualRepairDate(): Date {
    return this._actualRepairDate;
  }

  get emergencyReason(): EmergencyReason {
    return this._emergencyReason;
  }

  get afterServiceWarningAcknowledged(): boolean {
    return this._afterServiceWarningAcknowledged;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
