import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 見積ID値オブジェクト
 */
export class EstimateId extends EntityId<"EstimateId"> {
  static generate(): EstimateId {
    return new EstimateId(EntityId.generateValue());
  }
}
