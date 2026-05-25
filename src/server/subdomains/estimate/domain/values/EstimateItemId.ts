import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 見積明細ID値オブジェクト
 */
export class EstimateItemId extends EntityId<"EstimateItemId"> {
  static generate(): EstimateItemId {
    return new EstimateItemId(EntityId.generateValue());
  }
}
