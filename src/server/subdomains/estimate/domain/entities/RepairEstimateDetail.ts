import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { FaultDescription } from "../values/FaultDescription";
import { RepairEstimateDetailId } from "../values/RepairEstimateDetailId";

/**
 * 事前修理見積詳細エンティティ（§6.2, §11.3.1）。
 *
 * estimateType = REPAIR の Estimate に 1:1 で付随する子エンティティ。
 * 修理対象機器・故障内容・修理予定日を保持する。Estimate 集約の内部
 * 子エンティティとしてバレル (entities/index.ts) からは export せず、
 * 集約外コードからの直接インスタンス化を構造的に禁止する。
 *
 * estimateType との排他的整合（ADR-0019）は集約ルート (Estimate) 側で
 * 担保される。
 */
export class RepairEstimateDetail {
  static readonly ENTITY_NAME = "事前修理見積詳細";

  private constructor(
    private readonly _id: RepairEstimateDetailId,
    private _targetProductId: ProductId,
    private _faultDescription: FaultDescription,
    private _scheduledRepairDate: Date,
    private readonly _createdAt: Date,
    private _updatedAt: Date
  ) {}

  static create(input: {
    targetProductId: ProductId;
    faultDescription: FaultDescription;
    scheduledRepairDate: Date;
  }): RepairEstimateDetail {
    const now = new Date();
    return new RepairEstimateDetail(
      RepairEstimateDetailId.generate(),
      input.targetProductId,
      input.faultDescription,
      input.scheduledRepairDate,
      now,
      now
    );
  }

  static reconstruct(input: {
    id: RepairEstimateDetailId;
    targetProductId: ProductId;
    faultDescription: FaultDescription;
    scheduledRepairDate: Date;
    createdAt: Date;
    updatedAt: Date;
  }): RepairEstimateDetail {
    return new RepairEstimateDetail(
      input.id,
      input.targetProductId,
      input.faultDescription,
      input.scheduledRepairDate,
      input.createdAt,
      input.updatedAt
    );
  }

  changeTargetProduct(newProductId: ProductId): void {
    this._targetProductId = newProductId;
    this._updatedAt = new Date();
  }

  changeFaultDescription(newDescription: FaultDescription): void {
    this._faultDescription = newDescription;
    this._updatedAt = new Date();
  }

  changeScheduledRepairDate(newDate: Date): void {
    this._scheduledRepairDate = newDate;
    this._updatedAt = new Date();
  }

  get id(): RepairEstimateDetailId {
    return this._id;
  }

  get targetProductId(): ProductId {
    return this._targetProductId;
  }

  get faultDescription(): FaultDescription {
    return this._faultDescription;
  }

  get scheduledRepairDate(): Date {
    return this._scheduledRepairDate;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
