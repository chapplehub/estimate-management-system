import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * isSoleMember（役割の唯一メンバーが当該従業員かを問う判定）の統合テスト（#565）。
 * 「この役割の唯一のメンバーを外すと承認者不在になる」ワーニング（#568 FE）の判定データ。
 * 実 Prisma で検証する（モック禁止・ADR-0012）。
 */
describe("PrismaRoleQueryService.isSoleMember", () => {
  // ファイル別プレフィックスで並列実行の P2002 を避ける（#327）。
  const TEST_ROLE_CDS = ["ROLE957", "ROLE958"];
  const TEST_EMP_CDS = ["EMP990710", "EMP990711"];

  let service: PrismaRoleQueryService;
  let deptId: string;
  let roleId: string;
  let emptyRoleId: string;
  let memberAId: string;
  let memberBId: string;

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
    roleId = generateId();
    emptyRoleId = generateId();
    await prisma.role.createMany({
      data: [
        { id: roleId, roleCd: TEST_ROLE_CDS[0], name: "対象役割", positionId: kachou!.id },
        { id: emptyRoleId, roleCd: TEST_ROLE_CDS[1], name: "無人役割", positionId: kachou!.id },
      ],
    });

    memberAId = generateId();
    memberBId = generateId();
    await prisma.employee.createMany({
      data: [
        {
          id: memberAId,
          employeeCd: TEST_EMP_CDS[0],
          email: "sole-member-a@test.example.com",
          name: "メンバーA",
          departmentId: deptId,
        },
        {
          id: memberBId,
          employeeCd: TEST_EMP_CDS[1],
          email: "sole-member-b@test.example.com",
          name: "メンバーB",
          departmentId: deptId,
        },
      ],
    });

    service = new PrismaRoleQueryService();
  });

  afterEach(cleanup);

  it("役割の唯一のメンバーが当該従業員なら true を返す", async () => {
    await prisma.employeeRole.create({ data: { employeeId: memberAId, roleId } });

    const result = await service.isSoleMember(roleId, memberAId);

    expect(result).toBe(true);
  });

  it("役割に複数メンバーがいるなら（当該従業員を含んでも）false を返す", async () => {
    await prisma.employeeRole.createMany({
      data: [
        { employeeId: memberAId, roleId },
        { employeeId: memberBId, roleId },
      ],
    });

    const result = await service.isSoleMember(roleId, memberAId);

    expect(result).toBe(false);
  });

  it("役割の唯一のメンバーが別の従業員なら false を返す", async () => {
    await prisma.employeeRole.create({ data: { employeeId: memberBId, roleId } });

    const result = await service.isSoleMember(roleId, memberAId);

    expect(result).toBe(false);
  });

  it("役割にメンバーが1人もいないなら false を返す", async () => {
    const result = await service.isSoleMember(emptyRoleId, memberAId);

    expect(result).toBe(false);
  });
});
