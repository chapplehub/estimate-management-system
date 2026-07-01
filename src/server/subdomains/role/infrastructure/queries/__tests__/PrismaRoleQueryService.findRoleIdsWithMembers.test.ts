import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * findRoleIdsWithMembers（承認チェーン組立て用の「役割メンバー有無」射影）の統合テスト（#417）。
 * 役割に承認者（EmployeeRole）が1人以上いるかを実 Prisma で検証する（モック禁止）。
 */
describe("PrismaRoleQueryService.findRoleIdsWithMembers", () => {
  // ファイル別プレフィックスで並列実行の P2002 を避ける（#327）。roleCd は VarChar(7)。
  const TEST_ROLE_CDS = ["ROLE923", "ROLE924"];
  const TEST_EMP_CDS = ["EMP990210"];

  let service: PrismaRoleQueryService;
  let deptId: string;
  let positionId: string;
  let roleWithMemberId: string;
  let roleWithoutMemberId: string;

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

    roleWithMemberId = generateId();
    roleWithoutMemberId = generateId();
    await prisma.role.createMany({
      data: [
        { id: roleWithMemberId, roleCd: TEST_ROLE_CDS[0], name: "メンバーあり役割", positionId },
        { id: roleWithoutMemberId, roleCd: TEST_ROLE_CDS[1], name: "メンバーなし役割", positionId },
      ],
    });

    // roleWithMember にだけメンバー（EmployeeRole）を1人結びつける。
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[0],
        email: "role-member@test.example.com",
        name: "メンバー従業員",
        departmentId: deptId,
      },
    });
    await prisma.employeeRole.create({
      data: { employeeId, roleId: roleWithMemberId },
    });

    service = new PrismaRoleQueryService();
  });

  afterEach(cleanup);

  it("メンバーがいる役割IDだけを集合で返す", async () => {
    const result = await service.findRoleIdsWithMembers([roleWithMemberId, roleWithoutMemberId]);

    expect(result).toEqual(new Set([roleWithMemberId]));
  });

  it("メンバー不在の役割だけを渡すと空集合を返す", async () => {
    const result = await service.findRoleIdsWithMembers([roleWithoutMemberId]);

    expect(result).toEqual(new Set());
  });

  it("空入力なら空集合を返す", async () => {
    const result = await service.findRoleIdsWithMembers([]);

    expect(result).toEqual(new Set());
  });
});
