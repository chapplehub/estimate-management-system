import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";

/**
 * 承認チェーン計画の値オブジェクト（§5・ADR-0062）
 *
 * `ApprovalChainBuilder`（§5・services/）が組織スナップショットから構築して返す、
 * 承認チェーンの設計図。具体役職（`finalApprovalPositionId`）として解決済みの
 * `goalPositionId` と、起点からゴールまで順序付けされた承認対象役割（`roleIds`）の列を持つ。
 *
 * 集約境界（ADR-0027/0036）の都合で、ビルダー（services/）は子エンティティ
 * `EstimateApprovalStep` を直接生成できない。そこでビルダーは本 VO を返し、集約内ファクトリ
 * `EstimateApplication.create` がこの計画を受けてステップ子を内部生成する。VO 計画は
 * 役割 ID の列であって子エンティティ型を露出しないため、境界規約を損なわない。
 *
 * 常に最低1役割を持つ（ADR-0003: 常に上位承認を求める）。
 */
export class ApprovalChainPlan {
  private readonly _roleIds: readonly RoleId[];

  private constructor(
    private readonly _goalPositionId: PositionId,
    roleIds: readonly RoleId[]
  ) {
    this._roleIds = [...roleIds];
  }

  /**
   * 承認チェーン計画を生成する。順序付き役割列は最低1件必要（ADR-0003）。
   */
  static create(goalPositionId: PositionId, orderedRoleIds: readonly RoleId[]): ApprovalChainPlan {
    if (orderedRoleIds.length === 0) {
      throw new BusinessRuleViolationError(
        "承認チェーンは最低1つの承認対象役割を持つ必要があります（ADR-0003: 常に上位承認を求める）"
      );
    }
    return new ApprovalChainPlan(goalPositionId, orderedRoleIds);
  }

  /** ゴール役職（解決済みの finalApprovalPositionId・別集約を ID 参照）。 */
  get goalPositionId(): PositionId {
    return this._goalPositionId;
  }

  /** 起点からゴールまで順序付けされた承認対象役割の列（防御的コピー）。 */
  get roleIds(): RoleId[] {
    return [...this._roleIds];
  }
}
