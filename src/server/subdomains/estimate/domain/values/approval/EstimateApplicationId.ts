import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 見積申請ID値オブジェクト
 *
 * 集約ルート `EstimateApplication` の identity。UUIDv7 をドメイン層で採番する
 * （ADR-0009）。`EstimateId` と同じく `generate()` で新規採番、復元は
 * 公開コンストラクタ（mapper から `new EstimateApplicationId(row.id)`）。
 */
export class EstimateApplicationId extends EntityId<"EstimateApplicationId"> {
  static generate(): EstimateApplicationId {
    return new EstimateApplicationId(EntityId.generateValue());
  }
}
