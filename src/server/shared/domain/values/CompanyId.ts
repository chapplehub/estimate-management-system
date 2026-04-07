import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 会社ID値オブジェクト
 *
 * Customer・DeliveryLocation が共有する Company テーブルのID。
 */
export class CompanyId extends EntityId<"CompanyId"> {
  static generate(): CompanyId {
    return new CompanyId(EntityId.generateValue());
  }
}
