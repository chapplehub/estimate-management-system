import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 承認免除ID値オブジェクト
 *
 * 独立した薄い集約ルート `EstimateApprovalExemption` の identity。
 * UUIDv7 をドメイン層で採番する（ADR-0009）。
 */
export class EstimateApprovalExemptionId extends EntityId<"EstimateApprovalExemptionId"> {
  static generate(): EstimateApprovalExemptionId {
    return new EstimateApprovalExemptionId(EntityId.generateValue());
  }
}
