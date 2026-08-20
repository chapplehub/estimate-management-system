import { InvalidArgumentError } from "@server/shared/errors/DomainError";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { ApprovalRequirementPolicy } from "@subdomains/estimate/domain/policies/approval/ApprovalRequirementPolicy";
import {
  ApprovalChainBuilder,
  type ApprovalChainBlockedReason,
  type ApprovalChainOrgRole,
} from "@subdomains/estimate/domain/services/approval/ApprovalChainBuilder";
import { ApprovalChainPlan } from "@subdomains/estimate/domain/values/approval/ApprovalChainPlan";
import { EstimateExemptionReason } from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { EstimateType } from "@subdomains/estimate/domain/values/EstimateType";
import { Money } from "@server/shared/domain/values/Money";
import {
  resolveApprovalGoalTiersByDepth,
  type PositionHierarchyNode,
} from "./resolveApprovalGoalTiersByDepth";

/** 役職段階対応をまだ持たない、組織から取得した素の役割ノード。 */
export type AssembleApprovalChainRole = {
  roleId: RoleId;
  superiorRoleId: RoleId | null;
  positionId: PositionId;
};

export type AssembleApprovalChainInput = {
  /** 対象バリエーションの税込合計（judge 入力・§4）。 */
  finalTotal: Money;
  /** 価格を持つ末端明細の商品区分（judge 入力・§4.2）。 */
  leafCategories: ProductCategory[];
  /** 見積区分（judge 入力・事後見積の免除判定に使う）。 */
  estimateType: EstimateType;
  /** 役職階層グラフ（深度→段階の解決に使う・ADR-0063）。 */
  positions: PositionHierarchyNode[];
  /** 起点からゴールまでを少なくとも含む役割ノード群。 */
  roles: AssembleApprovalChainRole[];
  /** メンバー（承認者）が1人以上いる役割IDの集合（§5.2）。 */
  roleIdsWithMembers: ReadonlySet<string>;
  /** 申請者の上位役割＝承認フローの起点（§5.1）。未設定なら null。 */
  applicantSuperiorRoleId: RoleId | null;
};

/** アセンブラの結果（免除／承認必要＝計画／構築不能＝業務理由）。 */
export type AssembleApprovalChainResult =
  | { kind: "EXEMPT"; reason: EstimateExemptionReason }
  | { kind: "REQUIRED"; plan: ApprovalChainPlan }
  | { kind: "BLOCKED"; reason: ApprovalChainBlockedReason };

/**
 * 承認チェーン組立ての純粋アセンブラ（#417・§4-§5）
 *
 * 「金額→抽象段階」（{@link ApprovalRequirementPolicy.judge}）と「組織構造→具体役職」
 * （{@link resolveApprovalGoalTiersByDepth} ＋ {@link ApprovalChainBuilder}）を application 層で
 * 配線する。リポジトリ・DB に触れず、取得済みの素データを引数で受ける純関数（ADR-0030/0052）。
 * 副作用が無いため申請プレビュー（クエリ）と申請実行（コマンド）の双方から共有して呼べる。
 *
 * 1. judge で免除/承認必要を判定。免除ならそのまま `EXEMPT` を返す（組織グラフは見ない）。
 * 2. 承認必要なら役職階層から各役職の段階を解決し（4段単一鎖でなければ resolver が
 *    `BusinessRuleViolationError` を投げる）、役割ノードへ段階・メンバー有無を付して
 *    組織スナップショットを組み立てる。
 * 3. {@link ApprovalChainBuilder.build} に委ね、`BUILT` を `REQUIRED`、`BLOCKED` を透過する。
 */
export function assembleApprovalChain(
  input: AssembleApprovalChainInput
): AssembleApprovalChainResult {
  const requirement = ApprovalRequirementPolicy.judge({
    finalTotal: input.finalTotal,
    leafCategories: input.leafCategories,
    estimateType: input.estimateType,
  });
  if (requirement.kind === "EXEMPT") {
    return { kind: "EXEMPT", reason: requirement.reason };
  }

  const tierByPositionId = resolveApprovalGoalTiersByDepth(input.positions);

  const roles: ApprovalChainOrgRole[] = input.roles.map((role) => {
    const positionTier = tierByPositionId.get(role.positionId.value);
    if (positionTier === undefined) {
      // 役割の役職が役職階層に無い＝呼び出し側の組立て不備（loader のバグ）。
      throw new InvalidArgumentError(
        `役割の役職が役職階層に含まれていません（positionId: ${role.positionId.value}）`
      );
    }
    return {
      roleId: role.roleId,
      superiorRoleId: role.superiorRoleId,
      positionId: role.positionId,
      positionTier,
      hasApprover: input.roleIdsWithMembers.has(role.roleId.value),
    };
  });

  const built = ApprovalChainBuilder.build({
    goalTier: requirement.goalTier,
    snapshot: { applicantSuperiorRoleId: input.applicantSuperiorRoleId, roles },
  });

  if (built.kind === "BLOCKED") {
    return { kind: "BLOCKED", reason: built.reason };
  }
  return { kind: "REQUIRED", plan: built.plan };
}
