import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 商品ID値オブジェクト
 */
export class ProductId extends EntityId<"ProductId"> {
  static generate(): ProductId {
    return new ProductId(EntityId.generateValue());
  }
}
