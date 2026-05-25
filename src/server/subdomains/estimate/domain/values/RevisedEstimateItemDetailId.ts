import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 改訂明細詳細ID値オブジェクト
 *
 * RevisedEstimateItemDetail（EstimateItem の 1:1 子要素）の識別子。
 */
export class RevisedEstimateItemDetailId extends EntityId<"RevisedEstimateItemDetailId"> {
  static generate(): RevisedEstimateItemDetailId {
    return new RevisedEstimateItemDetailId(EntityId.generateValue());
  }
}
