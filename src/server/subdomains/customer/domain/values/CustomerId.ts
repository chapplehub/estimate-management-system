import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 得意先ID値オブジェクト
 */
export class CustomerId extends EntityId<"CustomerId"> {
  static generate(): CustomerId {
    return new CustomerId(EntityId.generateValue());
  }
}
