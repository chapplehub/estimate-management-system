import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ApprovalGoalTier } from "@subdomains/estimate/domain/values/approval/ApprovalGoalTier";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { describe, expect, it } from "vitest";
import {
  resolveApprovalGoalTiersByDepth,
  type PositionHierarchyNode,
} from "../resolveApprovalGoalTiersByDepth";

/**
 * 根（superiorPositionId = null）を起点に、指定段数の単一鎖を組む。
 * length=4 が業務の不変条件を満たす唯一の正常形。
 */
function linearChain(length: number): PositionHierarchyNode[] {
  const ids = Array.from({ length }, () => PositionId.generate());
  return ids.map((positionId, index) => ({
    positionId,
    superiorPositionId: index === 0 ? null : ids[index - 1],
  }));
}

/**
 * 課長 → 部長 → 本部長 → 社長 の 4 段単一鎖を組む。
 * 社長（根）は superiorPositionId = null、以降は直近上位を指す。
 */
function fourLevelChain(): {
  president: PositionId;
  divisionManager: PositionId;
  departmentManager: PositionId;
  sectionManager: PositionId;
  nodes: PositionHierarchyNode[];
} {
  const president = PositionId.generate();
  const divisionManager = PositionId.generate();
  const departmentManager = PositionId.generate();
  const sectionManager = PositionId.generate();
  const nodes: PositionHierarchyNode[] = [
    { positionId: president, superiorPositionId: null },
    { positionId: divisionManager, superiorPositionId: president },
    { positionId: departmentManager, superiorPositionId: divisionManager },
    { positionId: sectionManager, superiorPositionId: departmentManager },
  ];
  return { president, divisionManager, departmentManager, sectionManager, nodes };
}

describe("resolveApprovalGoalTiersByDepth", () => {
  describe("正常系: 4 段の単一鎖を承認段階へ写像する", () => {
    it("根からの距離で各役職に承認段階を割り当てる（0→社長 … 3→課長）", () => {
      const { president, divisionManager, departmentManager, sectionManager, nodes } =
        fourLevelChain();

      const tiers = resolveApprovalGoalTiersByDepth(nodes);

      expect(tiers.get(president.value)).toBe(ApprovalGoalTier.PRESIDENT);
      expect(tiers.get(divisionManager.value)).toBe(ApprovalGoalTier.DIVISION_MANAGER);
      expect(tiers.get(departmentManager.value)).toBe(ApprovalGoalTier.DEPARTMENT_MANAGER);
      expect(tiers.get(sectionManager.value)).toBe(ApprovalGoalTier.SECTION_MANAGER);
    });

    it("入力配列の順序に依存しない（葉から根の逆順でも同結果）", () => {
      const { president, divisionManager, departmentManager, sectionManager, nodes } =
        fourLevelChain();

      const tiers = resolveApprovalGoalTiersByDepth([...nodes].reverse());

      expect(tiers.get(sectionManager.value)).toBe(ApprovalGoalTier.SECTION_MANAGER);
      expect(tiers.get(departmentManager.value)).toBe(ApprovalGoalTier.DEPARTMENT_MANAGER);
      expect(tiers.get(divisionManager.value)).toBe(ApprovalGoalTier.DIVISION_MANAGER);
      expect(tiers.get(president.value)).toBe(ApprovalGoalTier.PRESIDENT);
    });
  });

  describe("異常系: 4 段の単一鎖でなければ申請時に fail-fast する", () => {
    it("鎖長が 4 未満（3 段）なら例外を投げる", () => {
      expect(() => resolveApprovalGoalTiersByDepth(linearChain(3))).toThrow(
        BusinessRuleViolationError
      );
    });

    it("鎖長が 4 超（5 段）なら例外を投げる", () => {
      expect(() => resolveApprovalGoalTiersByDepth(linearChain(5))).toThrow(
        BusinessRuleViolationError
      );
    });

    it("根（最上位役職）が不在なら例外を投げる", () => {
      // 4 ノードだが全員が上位を持つ（閉路で根が無い）
      const a = PositionId.generate();
      const b = PositionId.generate();
      const c = PositionId.generate();
      const d = PositionId.generate();
      const rootless: PositionHierarchyNode[] = [
        { positionId: a, superiorPositionId: d },
        { positionId: b, superiorPositionId: a },
        { positionId: c, superiorPositionId: b },
        { positionId: d, superiorPositionId: c },
      ];
      expect(() => resolveApprovalGoalTiersByDepth(rootless)).toThrow(BusinessRuleViolationError);
    });

    it("根が複数あれば例外を投げる", () => {
      const chain = linearChain(4);
      // 葉（最後のノード）の上位を切って 2 つ目の根にする
      const twoRoots: PositionHierarchyNode[] = chain.map((node, index) =>
        index === chain.length - 1 ? { ...node, superiorPositionId: null } : node
      );
      expect(() => resolveApprovalGoalTiersByDepth(twoRoots)).toThrow(BusinessRuleViolationError);
    });

    it("枝分かれ（同一上位を持つ役職が複数）なら例外を投げる", () => {
      const root = PositionId.generate();
      const childA = PositionId.generate();
      const childB = PositionId.generate();
      const grandChild = PositionId.generate();
      const branched: PositionHierarchyNode[] = [
        { positionId: root, superiorPositionId: null },
        { positionId: childA, superiorPositionId: root },
        { positionId: childB, superiorPositionId: root }, // root を上位に持つ 2 つ目
        { positionId: grandChild, superiorPositionId: childA },
      ];
      expect(() => resolveApprovalGoalTiersByDepth(branched)).toThrow(BusinessRuleViolationError);
    });

    it("親参照先が入力に存在しない（壊れた階層）なら例外を投げる", () => {
      const chain = linearChain(4);
      // 2 番目のノードの上位を、入力に存在しない ID に差し替える
      const broken: PositionHierarchyNode[] = chain.map((node, index) =>
        index === 1 ? { ...node, superiorPositionId: PositionId.generate() } : node
      );
      expect(() => resolveApprovalGoalTiersByDepth(broken)).toThrow(BusinessRuleViolationError);
    });
  });
});
