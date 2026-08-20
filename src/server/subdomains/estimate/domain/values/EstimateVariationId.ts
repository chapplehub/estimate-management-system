import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 見積バリエーションID値オブジェクト
 */
export class EstimateVariationId extends EntityId<"EstimateVariationId"> {
  static generate(): EstimateVariationId {
    return new EstimateVariationId(EntityId.generateValue());
  }
}
