import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 事前修理見積詳細ID値オブジェクト
 *
 * RepairEstimateDetail（estimateType = REPAIR の Estimate に 1:1）の識別子。
 */
export class RepairEstimateDetailId extends EntityId<"RepairEstimateDetailId"> {
  static generate(): RepairEstimateDetailId {
    return new RepairEstimateDetailId(EntityId.generateValue());
  }
}
