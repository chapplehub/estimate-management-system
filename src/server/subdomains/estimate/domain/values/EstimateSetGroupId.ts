import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * セット群ID値オブジェクト（ADR-0047 / Shape ③-a）。
 *
 * 交差表 `estimate_set_components` は `item_id` を PK とし surrogate id を持たないため、
 * 集約内で識別子を持つのはセット群（`estimate_set_groups.id`）のみ。
 */
export class EstimateSetGroupId extends EntityId<"EstimateSetGroupId"> {
  static generate(): EstimateSetGroupId {
    return new EstimateSetGroupId(EntityId.generateValue());
  }
}
