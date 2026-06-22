import { EntityId } from "@server/shared/domain/values/EntityId";

/**
 * 承認ステップID値オブジェクト
 *
 * 子エンティティ `EstimateApprovalStep` の identity。終端イベント（承認/差戻）は
 * このステップ ID を自然キーとして借りる（独自 ID を持たない・ADR-0041）。
 * UUIDv7 をドメイン層で採番する（ADR-0009）。
 */
export class EstimateApprovalStepId extends EntityId<"EstimateApprovalStepId"> {
  static generate(): EstimateApprovalStepId {
    return new EstimateApprovalStepId(EntityId.generateValue());
  }
}
