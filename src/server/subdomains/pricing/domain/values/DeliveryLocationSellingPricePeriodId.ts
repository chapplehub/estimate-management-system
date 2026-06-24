import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 納品先別販売単価の適用期間行の identity（サロゲート UUIDv7）。
 *
 * 自然キー（納品先 × 商品 × 適用開始日）を主キーにすると、開始日の補正で identity が動き
 * 差分 upsert（ADR-0032）が壊れるため、行ごとにサロゲート ID を持たせる。共通・得意先別の
 * 期間行 ID と同型だが、宛先の異なる別集約のため別 branded 型として分ける（ADR-20260624-8tg）。
 */
export class DeliveryLocationSellingPricePeriodId extends EntityId<"DeliveryLocationSellingPricePeriodId"> {
  static generate(): DeliveryLocationSellingPricePeriodId {
    return new DeliveryLocationSellingPricePeriodId(EntityId.generateValue());
  }
}
