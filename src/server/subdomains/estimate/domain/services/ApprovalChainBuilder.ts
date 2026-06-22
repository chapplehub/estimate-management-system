import {
  BusinessRuleViolationError,
  InvalidArgumentError,
} from "@server/shared/errors/DomainError";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { ApprovalChainPlan } from "../values/approval/ApprovalChainPlan";
import { ApprovalGoalTier } from "../values/approval/ApprovalGoalTier";

/**
 * 承認チェーン構築に渡す組織スナップショットの役割ノード（§5.1・ADR-0062）。
 *
 * アプリ層が組織サブドメイン（role / position / employee）から組み立てて引数で渡す
 * （ドメインにリポジトリポートを持たせない・ADR-0030/0052）。`positionTier` は具体役職を
 * 抽象段階へ対応づけた「役職段階対応」で、どの役職が課長/部長…かというアプリ層が解決済みの
 * 情報（ADR-0062）。
 */
export type ApprovalChainOrgRole = {
  roleId: RoleId;
  /** 上位役割（辿って上位へ進む・§5.1）。最上位なら null。 */
  superiorRoleId: RoleId | null;
  /** この役割の役職（到達時に finalApprovalPositionId となる）。 */
  positionId: PositionId;
  /** この役割の役職の抽象段階（役職段階対応・ADR-0062）。 */
  positionTier: ApprovalGoalTier;
  /** この役割に承認者（メンバー）が1人以上いるか（§5.2・ADR-0002）。 */
  hasApprover: boolean;
};

/** 承認チェーン構築の組織スナップショット（§5.1）。 */
export type ApprovalChainOrgSnapshot = {
  /** 承認フローの起点＝申請者の上位役割（Employee.superiorRoleId・§5.1）。未設定なら null。 */
  applicantSuperiorRoleId: RoleId | null;
  /** チェーン探索に必要な役割ノード群（起点からゴールまでを少なくとも含む）。 */
  roles: ApprovalChainOrgRole[];
};

export type ApprovalChainBuildInput = {
  /** 承認要否ポリシーが算出した抽象ゴール段階（§4・ADR-0062）。 */
  goalTier: ApprovalGoalTier;
  snapshot: ApprovalChainOrgSnapshot;
};

/**
 * 承認チェーン構築ドメインサービス（§5・ADR-0002/0003/0062）
 *
 * 申請者の上位役割（起点）から、役割の上位役割（`superiorRoleId`）を辿ってゴール段階の役職に
 * 到達するまでの承認対象役割列を組み立て、VO 計画 {@link ApprovalChainPlan} を返す。組織グラフは
 * 引数（スナップショット）で受け取り、ドメインにリポジトリポートを持たせない（ADR-0030/0052）。
 *
 * - 常に最低1段の承認を求める（ADR-0003）。起点の役職が既にゴール以上でも起点1段は生成する。
 * - 「上位役割の役職は役職の上位役職」という不変条件（§5.1）により、役割を1段上がると役職も
 *   ちょうど1段上がりゴールを飛び越さないため、到達役割の役職が一意に finalApprovalPositionId と
 *   なる（ADR-0062）。
 * - 起点未設定・ゴール到達不能・承認者不在は例外（ADR-0038）。
 *
 * 子エンティティ（`EstimateApprovalStep`）は集約外（services）から生成できない（ADR-0027）ため、
 * 本サービスは VO 計画のみを返し、ステップ事前生成は集約内ファクトリ
 * `EstimateApplication.create` が担う（ADR-0036）。
 */
export class ApprovalChainBuilder {
  private constructor() {}

  static build(input: ApprovalChainBuildInput): ApprovalChainPlan {
    const { goalTier, snapshot } = input;

    if (snapshot.applicantSuperiorRoleId === null) {
      throw new BusinessRuleViolationError(
        "申請者の上位役割が未設定のため承認チェーンを構築できません（§5.2）"
      );
    }

    const roleById = new Map(snapshot.roles.map((role) => [role.roleId.value, role]));
    const lookup = (roleId: RoleId): ApprovalChainOrgRole => {
      const role = roleById.get(roleId.value);
      if (role === undefined) {
        // スナップショットに必要な役割が含まれていない＝入力の組み立て不備（呼び出し側のバグ）。
        throw new InvalidArgumentError(
          `組織スナップショットに役割が含まれていません（roleId: ${roleId.value}）`
        );
      }
      return role;
    };

    const chain: ApprovalChainOrgRole[] = [];
    const visited = new Set<string>();
    let current = lookup(snapshot.applicantSuperiorRoleId);

    // 起点を必ず1段含めたうえで、ゴール段階に到達するまで上位役割を辿る（ADR-0003）。
    for (;;) {
      if (visited.has(current.roleId.value)) {
        throw new InvalidArgumentError("役割グラフに循環があります");
      }
      visited.add(current.roleId.value);
      chain.push(current);

      if (current.positionTier.isAtLeast(goalTier)) {
        break;
      }
      if (current.superiorRoleId === null) {
        throw new BusinessRuleViolationError(
          "ゴール役職に到達できません（承認チェーンが途切れています・§5.2）"
        );
      }
      current = lookup(current.superiorRoleId);
    }

    // 各ステップ役割に承認者が存在するか検証する（§5.2・ADR-0002）。
    for (const role of chain) {
      if (!role.hasApprover) {
        throw new BusinessRuleViolationError(
          `承認対象役割に承認者が存在しません（roleId: ${role.roleId.value}）`
        );
      }
    }

    // 到達役割の役職を finalApprovalPositionId とする（§5.3・ADR-0062）。
    return ApprovalChainPlan.create(
      current.positionId,
      chain.map((role) => role.roleId)
    );
  }
}
