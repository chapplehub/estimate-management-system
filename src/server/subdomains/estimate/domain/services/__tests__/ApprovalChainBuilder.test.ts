import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { describe, expect, it } from "vitest";
import { ApprovalChainBuilder, type ApprovalChainOrgRole } from "../ApprovalChainBuilder";
import { ApprovalGoalTier } from "../../values/ApprovalGoalTier";

/** 上位リンクで連なる役割ノード列を作る（index 昇順で下位→上位）。tiers の順に役職段階を割り当てる。 */
const buildRoleChain = (tiers: ApprovalGoalTier[]): ApprovalChainOrgRole[] => {
  const roleIds = tiers.map(() => RoleId.generate());
  return tiers.map((tier, index) => ({
    roleId: roleIds[index],
    superiorRoleId: index + 1 < roleIds.length ? roleIds[index + 1] : null,
    positionId: PositionId.generate(),
    positionTier: tier,
    hasApprover: true,
  }));
};

describe("ApprovalChainBuilder", () => {
  describe("正常系", () => {
    it("起点（課長）からゴール（部長）まで2段のチェーンを構築する（§5.4）", () => {
      const roles = buildRoleChain([
        ApprovalGoalTier.SECTION_MANAGER,
        ApprovalGoalTier.DEPARTMENT_MANAGER,
      ]);

      const plan = ApprovalChainBuilder.build({
        goalTier: ApprovalGoalTier.DEPARTMENT_MANAGER,
        snapshot: { applicantSuperiorRoleId: roles[0].roleId, roles },
      });

      expect(plan.roleIds).toHaveLength(2);
      expect(plan.roleIds[0].equals(roles[0].roleId)).toBe(true);
      expect(plan.roleIds[1].equals(roles[1].roleId)).toBe(true);
      // 到達役職（末尾ステップの役職）が finalApprovalPositionId
      expect(plan.goalPositionId.equals(roles[1].positionId)).toBe(true);
    });

    it("起点の役職が既にゴール以上なら起点1段のみ（ADR-0003）", () => {
      const roles = buildRoleChain([
        ApprovalGoalTier.DEPARTMENT_MANAGER,
        ApprovalGoalTier.DIVISION_MANAGER,
      ]);

      const plan = ApprovalChainBuilder.build({
        goalTier: ApprovalGoalTier.SECTION_MANAGER,
        snapshot: { applicantSuperiorRoleId: roles[0].roleId, roles },
      });

      expect(plan.roleIds).toHaveLength(1);
      expect(plan.roleIds[0].equals(roles[0].roleId)).toBe(true);
      expect(plan.goalPositionId.equals(roles[0].positionId)).toBe(true);
    });

    it("課長→部長→本部長の3段を構築する", () => {
      const roles = buildRoleChain([
        ApprovalGoalTier.SECTION_MANAGER,
        ApprovalGoalTier.DEPARTMENT_MANAGER,
        ApprovalGoalTier.DIVISION_MANAGER,
      ]);

      const plan = ApprovalChainBuilder.build({
        goalTier: ApprovalGoalTier.DIVISION_MANAGER,
        snapshot: { applicantSuperiorRoleId: roles[0].roleId, roles },
      });

      expect(plan.roleIds.map((r) => r.value)).toEqual(roles.map((n) => n.roleId.value));
      expect(plan.goalPositionId.equals(roles[2].positionId)).toBe(true);
    });
  });

  describe("異常系（§5.2・ADR-0038）", () => {
    it("起点（申請者の上位役割）が未設定なら例外", () => {
      const roles = buildRoleChain([ApprovalGoalTier.SECTION_MANAGER]);

      expect(() =>
        ApprovalChainBuilder.build({
          goalTier: ApprovalGoalTier.SECTION_MANAGER,
          snapshot: { applicantSuperiorRoleId: null, roles },
        })
      ).toThrow(BusinessRuleViolationError);
    });

    it("ゴール役職に到達する前にチェーンが途切れたら例外", () => {
      const roles = buildRoleChain([
        ApprovalGoalTier.SECTION_MANAGER,
        ApprovalGoalTier.DEPARTMENT_MANAGER,
      ]);

      expect(() =>
        ApprovalChainBuilder.build({
          goalTier: ApprovalGoalTier.PRESIDENT,
          snapshot: { applicantSuperiorRoleId: roles[0].roleId, roles },
        })
      ).toThrow(BusinessRuleViolationError);
    });

    it("チェーン上の役割に承認者が不在なら例外（ADR-0002）", () => {
      const roles = buildRoleChain([
        ApprovalGoalTier.SECTION_MANAGER,
        ApprovalGoalTier.DEPARTMENT_MANAGER,
      ]);
      roles[1] = { ...roles[1], hasApprover: false };

      expect(() =>
        ApprovalChainBuilder.build({
          goalTier: ApprovalGoalTier.DEPARTMENT_MANAGER,
          snapshot: { applicantSuperiorRoleId: roles[0].roleId, roles },
        })
      ).toThrow(BusinessRuleViolationError);
    });
  });
});
