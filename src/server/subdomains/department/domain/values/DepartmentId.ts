import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 部署ID値オブジェクト
 */
export class DepartmentId extends EntityId<"DepartmentId"> {
  static generate(): DepartmentId {
    return new DepartmentId(EntityId.generateValue());
  }
}
