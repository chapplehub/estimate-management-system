import { ApprovalGoalTier } from "@subdomains/estimate/domain/values/ApprovalGoalTier";
import { PositionId } from "@subdomains/position/domain/values/PositionId";

/**
 * 役職階層グラフの 1 ノード（resolver が必要とする最小射影）。
 *
 * position サブドメインの集約エンティティ型に依存せず、自己参照（`superiorPositionId`）
 * だけを素のまま受け取る（ADR-0052 / ADR-0030 の引数渡し・疎結合）。
 */
export type PositionHierarchyNode = {
  positionId: PositionId;
  superiorPositionId: PositionId | null;
};

/**
 * 根（社長）からの距離 → 承認段階の写像（ADR-0063）。
 * 添字（距離）そのものを段階の根拠とし、別表での二重管理を避ける。
 */
const TIER_BY_DEPTH = [
  ApprovalGoalTier.PRESIDENT, // 距離 0: 社長
  ApprovalGoalTier.DIVISION_MANAGER, // 距離 1: 本部長
  ApprovalGoalTier.DEPARTMENT_MANAGER, // 距離 2: 部長
  ApprovalGoalTier.SECTION_MANAGER, // 距離 3: 課長
] as const;

/**
 * 役職グラフから各役職の承認段階（`ApprovalGoalTier`）を解決する純関数（ADR-0063）。
 *
 * 最上位役職（`superiorPositionId = null` ＝社長）を構造的アンカーとし、根からの階層深さで
 * 承認段階を割り当てる（距離 0→社長段階 … 3→課長段階）。`PositionName` の自由文字列にも
 * 専用マッピングにも依存せず、「4 役職 = 4 承認段階」という業務不変条件を構造から導出する。
 *
 * リポジトリ・DB・コマンドに依存しない純関数。取得済みの役職グラフを引数で受ける。
 *
 * @returns キー = `PositionId.value`、値 = 解決済み `ApprovalGoalTier` の Map
 */
export function resolveApprovalGoalTiersByDepth(
  nodes: readonly PositionHierarchyNode[]
): Map<string, ApprovalGoalTier> {
  const superiorByPositionId = new Map<string, PositionId | null>(
    nodes.map((node) => [node.positionId.value, node.superiorPositionId])
  );

  const tiers = new Map<string, ApprovalGoalTier>();
  for (const node of nodes) {
    let distance = 0;
    let superiorId = node.superiorPositionId;
    while (superiorId !== null) {
      distance += 1;
      superiorId = superiorByPositionId.get(superiorId.value) ?? null;
    }
    tiers.set(node.positionId.value, TIER_BY_DEPTH[distance]);
  }

  return tiers;
}
