import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 共通販売単価の適用期間行の identity（サロゲート UUIDv7）。
 *
 * 自然キー（商品 × 適用開始日）を主キーにすると、開始日の補正で identity が動き
 * 差分 upsert（ADR-0032）が壊れるため、行ごとにサロゲート ID を持たせる。
 */
export class CommonSellingPricePeriodId extends EntityId<"CommonSellingPricePeriodId"> {
  static generate(): CommonSellingPricePeriodId {
    return new CommonSellingPricePeriodId(EntityId.generateValue());
  }
}
