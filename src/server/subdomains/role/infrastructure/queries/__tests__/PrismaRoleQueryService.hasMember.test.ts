import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * hasMember（承認者が当該役割のメンバーかを問う個人認可判定）の統合テスト（#418）。
 * 承認/差戻コマンドが「この承認者はこのステップの役割に属するか」を判定するために使う。
 * 実 Prisma で検証する（モック禁止・ADR-0012）。
 */
describe("PrismaRoleQueryService.hasMember", () => {
  // ファイル別プレフィックスで並列実行の P2002 を避ける（#327）。roleCd は VarChar(7)。
  const TEST_ROLE_CDS = ["ROLE933", "ROLE934"];
  const TEST_EMP_CDS = ["EMP990310", "EMP990311"];

  let service: PrismaRoleQueryService;
  let deptId: string;
  let positionId: string;
  let roleId: string;
  let otherRoleId: string;
  let memberEmployeeId: string;
  let nonMemberEmployeeId: string;

  async function cleanup() {
    await prisma.employeeRole.deleteMany({
      where: { role: { roleCd: { in: TEST_ROLE_CDS } } },
    });
    await prisma.employee.deleteMany({ where: { employeeCd: { in: TEST_EMP_CDS } } });
    await prisma.role.deleteMany({ where: { roleCd: { in: TEST_ROLE_CDS } } });
  }

  beforeEach(async () => {
    await cleanup();
    deptId = await ensureTestDepartment();

    const kachou = await prisma.position.findUnique({ where: { positionCd: "POS001" } });
    positionId = kachou!.id;

    roleId = generateId();
    otherRoleId = generateId();
    await prisma.role.createMany({
      data: [
        { id: roleId, roleCd: TEST_ROLE_CDS[0], name: "対象役割", positionId },
        { id: otherRoleId, roleCd: TEST_ROLE_CDS[1], name: "別役割", positionId },
      ],
    });

    memberEmployeeId = generateId();
    nonMemberEmployeeId = generateId();
    await prisma.employee.createMany({
      data: [
        {
          id: memberEmployeeId,
          employeeCd: TEST_EMP_CDS[0],
          email: "has-member-member@test.example.com",
          name: "メンバー従業員",
          departmentId: deptId,
        },
        {
          id: nonMemberEmployeeId,
          employeeCd: TEST_EMP_CDS[1],
          email: "has-member-nonmember@test.example.com",
          name: "非メンバー従業員",
          departmentId: deptId,
        },
      ],
    });

    // memberEmployee を対象役割に、nonMemberEmployee を別役割にだけ結びつける。
    await prisma.employeeRole.createMany({
      data: [
        { employeeId: memberEmployeeId, roleId },
        { employeeId: nonMemberEmployeeId, roleId: otherRoleId },
      ],
    });

    service = new PrismaRoleQueryService();
  });

  afterEach(cleanup);

  it("従業員が役割のメンバーなら true を返す", async () => {
    const result = await service.hasMember(roleId, memberEmployeeId);

    expect(result).toBe(true);
  });

  it("従業員が別役割にしか属さないなら false を返す", async () => {
    const result = await service.hasMember(roleId, nonMemberEmployeeId);

    expect(result).toBe(false);
  });

  it("従業員がどの役割にも属さないなら false を返す", async () => {
    const result = await service.hasMember(roleId, generateId());

    expect(result).toBe(false);
  });
});
