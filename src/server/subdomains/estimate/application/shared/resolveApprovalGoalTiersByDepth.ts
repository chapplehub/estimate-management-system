import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
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
 * 配列長（= 4）が「正確に 4 段の単一鎖」という不変条件の段数でもある。
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
 * 深さ算出の唯一の弱点は、前提（4 段の単一鎖）が破れたとき段がずれて**黙って**誤った承認
 * ルーティングを生むこと。これを打ち消すため「最上位を起点に正確に 4 段の単一鎖」であることを
 * 検証し、破れていれば `BusinessRuleViolationError` を投げる（申請時 fail-fast）。
 *
 * リポジトリ・DB・コマンドに依存しない純関数。取得済みの役職グラフを引数で受ける。
 *
 * @returns キー = `PositionId.value`、値 = 解決済み `ApprovalGoalTier` の Map
 * @throws {BusinessRuleViolationError} 根が不在/複数・親参照切れ・枝分かれ・鎖長 ≠ 4 のいずれか
 */
export function resolveApprovalGoalTiersByDepth(
  nodes: readonly PositionHierarchyNode[]
): Map<string, ApprovalGoalTier> {
  const nodeById = new Map(nodes.map((node) => [node.positionId.value, node]));

  // 根（superiorPositionId = null）は構造的アンカー。正確に 1 件でなければならない。
  const roots = nodes.filter((node) => node.superiorPositionId === null);
  if (roots.length !== 1) {
    throw new BusinessRuleViolationError(
      `承認段階を解決できません: 最上位役職（社長）が ${roots.length} 件です（正確に 1 件である必要があります）`
    );
  }

  // 上位役職ごとの直属の部下を 1 つに束ねる。辿る際は親→子の単一辺として使う。
  // ここで「親参照切れ（入力に存在しない上位）」と「枝分かれ（同一上位を複数が持つ）」を検出する。
  const childBySuperiorId = new Map<string, PositionHierarchyNode>();
  for (const node of nodes) {
    const superiorId = node.superiorPositionId;
    if (superiorId === null) {
      continue;
    }
    if (!nodeById.has(superiorId.value)) {
      throw new BusinessRuleViolationError(
        `承認段階を解決できません: 上位役職 ${superiorId.value} が入力に存在しません（壊れた階層）`
      );
    }
    if (childBySuperiorId.has(superiorId.value)) {
      throw new BusinessRuleViolationError(
        "承認段階を解決できません: 同一の上位役職を持つ役職が複数あります（枝分かれ・単一鎖ではありません）"
      );
    }
    childBySuperiorId.set(superiorId.value, node);
  }

  // 根から直属の部下を辿り、距離→段階で写像する。
  // 写像は最大 4 段で打ち切る（5 段以上は下のサイズ検査で弾く）。
  const tiers = new Map<string, ApprovalGoalTier>();
  let current: PositionHierarchyNode | undefined = roots[0];
  for (let distance = 0; distance < TIER_BY_DEPTH.length && current !== undefined; distance += 1) {
    tiers.set(current.positionId.value, TIER_BY_DEPTH[distance]);
    current = childBySuperiorId.get(current.positionId.value);
  }

  // 「最上位から正確に 4 段の単一鎖」: 写像した段数も全役職数も 4 でなければならない。
  // 鎖長 ≠ 4（3 段・5 段）や、根から到達できない成分（閉路など）はここで顕在化する。
  if (tiers.size !== TIER_BY_DEPTH.length || nodes.length !== TIER_BY_DEPTH.length) {
    throw new BusinessRuleViolationError(
      `承認段階を解決できません: 最上位から正確に ${TIER_BY_DEPTH.length} 段の単一鎖である必要があります` +
        `（役職数 ${nodes.length}・根から解決できた段数 ${tiers.size}）`
    );
  }

  return tiers;
}
