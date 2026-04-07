import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 従業員ID値オブジェクト
 */
export class EmployeeId extends EntityId<"EmployeeId"> {
  static generate(): EmployeeId {
    return new EmployeeId(EntityId.generateValue());
  }
}
