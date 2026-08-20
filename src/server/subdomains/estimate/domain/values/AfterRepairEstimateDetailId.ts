import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 事後修理見積詳細ID値オブジェクト
 *
 * AfterRepairEstimateDetail（estimateType = AFTER_REPAIR の Estimate に 1:1）
 * の識別子。
 */
export class AfterRepairEstimateDetailId extends EntityId<"AfterRepairEstimateDetailId"> {
  static generate(): AfterRepairEstimateDetailId {
    return new AfterRepairEstimateDetailId(EntityId.generateValue());
  }
}
