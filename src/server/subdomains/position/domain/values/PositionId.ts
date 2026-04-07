import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 役職ID値オブジェクト
 */
export class PositionId extends EntityId<"PositionId"> {
  static generate(): PositionId {
    return new PositionId(EntityId.generateValue());
  }
}
