import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 納品先ID値オブジェクト
 */
export class DeliveryLocationId extends EntityId<"DeliveryLocationId"> {
  static generate(): DeliveryLocationId {
    return new DeliveryLocationId(EntityId.generateValue());
  }
}
