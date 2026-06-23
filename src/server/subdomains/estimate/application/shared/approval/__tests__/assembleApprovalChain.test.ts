import { Money } from "@server/shared/domain/values/Money";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { EstimateExemptionReason } from "@subdomains/estimate/domain/values/approval/EstimateExemptionReason";
import { EstimateType } from "@subdomains/estimate/domain/values/EstimateType";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { describe, expect, it } from "vitest";
import { assembleApprovalChain, type AssembleApprovalChainInput } from "../assembleApprovalChain";

/**
 * 課長→部長→本部長→社長の4段単一鎖（役職）と、それに1対1で対応する役割チェーンを組む。
 * 役割は下位→上位に superiorRoleId で連なり、起点は課長役割。全役割にメンバーありが既定。
 */
function buildFourLevelOrg() {
  const presidentPos = PositionId.generate();
  const divisionPos = PositionId.generate();
  const departmentPos = PositionId.generate();
  const sectionPos = PositionId.generate();
  const positions = [
    { positionId: presidentPos, superiorPositionId: null },
    { positionId: divisionPos, superiorPositionId: presidentPos },
    { positionId: departmentPos, superiorPositionId: divisionPos },
    { positionId: sectionPos, superiorPositionId: departmentPos },
  ];

  const presidentRole = RoleId.generate();
  const divisionRole = RoleId.generate();
  const departmentRole = RoleId.generate();
  const sectionRole = RoleId.generate();
  const roles = [
    { roleId: presidentRole, superiorRoleId: null, positionId: presidentPos },
    { roleId: divisionRole, superiorRoleId: presidentRole, positionId: divisionPos },
    { roleId: departmentRole, superiorRoleId: divisionRole, positionId: departmentPos },
    { roleId: sectionRole, superiorRoleId: departmentRole, positionId: sectionPos },
  ];
  const allRoleIds = [presidentRole, divisionRole, departmentRole, sectionRole];

  return {
    positions,
    roles,
    presidentPos,
    divisionPos,
    departmentPos,
    sectionPos,
    presidentRole,
    divisionRole,
    departmentRole,
    sectionRole,
    allRoleIds,
    allMembers: new Set(allRoleIds.map((r) => r.value)),
  };
}

/** 承認必要（非消耗品・新規）を既定にした入力を、上書きしつつ組む。 */
function inputWith(
  org: ReturnType<typeof buildFourLevelOrg>,
  overrides: Partial<AssembleApprovalChainInput>
): AssembleApprovalChainInput {
  return {
    finalTotal: Money.fromMajorUnits(1_000_000),
    leafCategories: [ProductCategory.INDIVIDUAL],
    estimateType: EstimateType.NEW,
    positions: org.positions,
    roles: org.roles,
    roleIdsWithMembers: org.allMembers,
    applicantSuperiorRoleId: org.sectionRole,
    ...overrides,
  };
}

describe("assembleApprovalChain", () => {
  it("金額段階(100万=部長)に応じて REQUIRED の承認チェーン計画を返す", () => {
    const org = buildFourLevelOrg();

    const result = assembleApprovalChain(
      inputWith(org, { finalTotal: Money.fromMajorUnits(1_000_000) })
    );

    expect(result.kind).toBe("REQUIRED");
    if (result.kind !== "REQUIRED") throw new Error(`expected REQUIRED, got ${result.kind}`);
    expect(result.plan.roleIds.map((r) => r.value)).toEqual([
      org.sectionRole.value,
      org.departmentRole.value,
    ]);
    expect(result.plan.goalPositionId.equals(org.departmentPos)).toBe(true);
  });

  it("金額段階(3000万=社長)では起点からゴールまで全段を辿る", () => {
    const org = buildFourLevelOrg();

    const result = assembleApprovalChain(
      inputWith(org, { finalTotal: Money.fromMajorUnits(30_000_000) })
    );

    expect(result.kind).toBe("REQUIRED");
    if (result.kind !== "REQUIRED") throw new Error(`expected REQUIRED, got ${result.kind}`);
    expect(result.plan.roleIds.map((r) => r.value)).toEqual([
      org.sectionRole.value,
      org.departmentRole.value,
      org.divisionRole.value,
      org.presidentRole.value,
    ]);
    expect(result.plan.goalPositionId.equals(org.presidentPos)).toBe(true);
  });

  it("価格付き末端明細がすべて消耗品なら EXEMPT(CONSUMABLE_ONLY)（組織を見ない）", () => {
    const org = buildFourLevelOrg();

    const result = assembleApprovalChain(
      inputWith(org, {
        finalTotal: Money.fromMajorUnits(5_000_000),
        leafCategories: [ProductCategory.CONSUMABLE],
      })
    );

    expect(result).toEqual({ kind: "EXEMPT", reason: EstimateExemptionReason.CONSUMABLE_ONLY });
  });

  it("税込合計が10万円未満なら EXEMPT(BELOW_THRESHOLD)", () => {
    const org = buildFourLevelOrg();

    const result = assembleApprovalChain(
      inputWith(org, { finalTotal: Money.fromMajorUnits(99_999) })
    );

    expect(result).toEqual({ kind: "EXEMPT", reason: EstimateExemptionReason.BELOW_THRESHOLD });
  });

  it("事後見積なら金額に関わらず EXEMPT(AFTER_REPAIR)", () => {
    const org = buildFourLevelOrg();

    const result = assembleApprovalChain(
      inputWith(org, {
        finalTotal: Money.fromMajorUnits(30_000_000),
        estimateType: EstimateType.AFTER_REPAIR,
      })
    );

    expect(result).toEqual({ kind: "EXEMPT", reason: EstimateExemptionReason.AFTER_REPAIR });
  });

  it("起点（申請者の上位役割）未設定なら builder の BLOCKED(NO_SUPERIOR_ROLE) を透過する", () => {
    const org = buildFourLevelOrg();

    const result = assembleApprovalChain(inputWith(org, { applicantSuperiorRoleId: null }));

    expect(result).toEqual({ kind: "BLOCKED", reason: "NO_SUPERIOR_ROLE" });
  });

  it("チェーン上の役割に承認者が不在なら builder の BLOCKED(NO_APPROVER) を透過する", () => {
    const org = buildFourLevelOrg();
    // ゴール(部長)役割からメンバーを外す。
    const membersWithoutDepartment = new Set(org.allMembers);
    membersWithoutDepartment.delete(org.departmentRole.value);

    const result = assembleApprovalChain(
      inputWith(org, { roleIdsWithMembers: membersWithoutDepartment })
    );

    expect(result).toEqual({ kind: "BLOCKED", reason: "NO_APPROVER" });
  });

  it("役職が4段単一鎖でなければ resolver 由来の BusinessRuleViolationError を投げる", () => {
    const org = buildFourLevelOrg();
    // 社長を落として3段にする（resolver は申請時 fail-fast）。
    const threeLevelPositions = org.positions.filter((p) => !p.positionId.equals(org.presidentPos));

    expect(() => assembleApprovalChain(inputWith(org, { positions: threeLevelPositions }))).toThrow(
      BusinessRuleViolationError
    );
  });
});
