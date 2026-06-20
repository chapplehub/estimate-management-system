import { ApprovalGoalTier } from "@subdomains/estimate/domain/values/ApprovalGoalTier";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { describe, expect, it } from "vitest";
import {
  resolveApprovalGoalTiersByDepth,
  type PositionHierarchyNode,
} from "../resolveApprovalGoalTiersByDepth";

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
});
