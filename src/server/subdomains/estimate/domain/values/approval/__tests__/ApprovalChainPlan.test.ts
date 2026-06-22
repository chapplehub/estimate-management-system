import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { describe, expect, it } from "vitest";
import { ApprovalChainPlan } from "../ApprovalChainPlan";

describe("ApprovalChainPlan", () => {
  describe("create() - 正常系", () => {
    it("ゴール役職と順序付き役割列を保持する", () => {
      const goal = PositionId.generate();
      const role1 = RoleId.generate();
      const role2 = RoleId.generate();

      const plan = ApprovalChainPlan.create(goal, [role1, role2]);

      expect(plan.goalPositionId.equals(goal)).toBe(true);
      expect(plan.roleIds).toHaveLength(2);
      expect(plan.roleIds[0].equals(role1)).toBe(true);
      expect(plan.roleIds[1].equals(role2)).toBe(true);
    });

    it("1役割のみ（起点がすでにゴール以上）でも成立する（ADR-0003）", () => {
      const plan = ApprovalChainPlan.create(PositionId.generate(), [RoleId.generate()]);

      expect(plan.roleIds).toHaveLength(1);
    });
  });

  describe("create() - 異常系", () => {
    it("役割が空なら拒否する（常に最低1ステップ・ADR-0003）", () => {
      expect(() => ApprovalChainPlan.create(PositionId.generate(), [])).toThrow(
        BusinessRuleViolationError
      );
    });
  });

  describe("roleIds の不変性", () => {
    it("取得した配列を破壊しても内部状態は変わらない", () => {
      const plan = ApprovalChainPlan.create(PositionId.generate(), [RoleId.generate()]);

      plan.roleIds.push(RoleId.generate());

      expect(plan.roleIds).toHaveLength(1);
    });
  });
});
