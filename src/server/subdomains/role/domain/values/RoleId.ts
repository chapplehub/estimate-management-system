import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 役割ID値オブジェクト
 */
export class RoleId extends EntityId<"RoleId"> {
  static generate(): RoleId {
    return new RoleId(EntityId.generateValue());
  }
}
