import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * 読み取り DTO への担当役割ID（assignedRoleId）射影の統合テスト（#565）。
 * 編集画面の現在値復元に使う。実 Prisma に対して検証する（モック禁止・ADR-0012）。
 */
describe("PrismaEmployeeQueryService 担当役割ID(assignedRoleId)", () => {
  // ファイル別プレフィックスで並列実行の P2002 を避ける（#327）。
  const TEST_EMP_CDS = ["EMP990510", "EMP990511"];
  const TEST_ROLE_CDS = ["ROLE956"];

  let service: PrismaEmployeeQueryService;
  let deptId: string;
  let roleId: string;

  async function cleanup() {
    await prisma.employeeRole.deleteMany({
      where: { employee: { employeeCd: { in: TEST_EMP_CDS } } },
    });
    await prisma.employee.deleteMany({ where: { employeeCd: { in: TEST_EMP_CDS } } });
    await prisma.role.deleteMany({ where: { roleCd: { in: TEST_ROLE_CDS } } });
  }

  beforeEach(async () => {
    await cleanup();
    deptId = await ensureTestDepartment();

    const kachou = await prisma.position.findUnique({ where: { positionCd: "POS001" } });
    roleId = generateId();
    await prisma.role.create({
      data: {
        id: roleId,
        roleCd: TEST_ROLE_CDS[0],
        name: "担当役割テスト",
        positionId: kachou!.id,
      },
    });

    service = new PrismaEmployeeQueryService();
  });

  afterEach(cleanup);

  it("担当役割を持つ従業員は findById で assignedRoleId を返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[0],
        email: "assigned-role@test.example.com",
        name: "担当役割あり従業員",
        departmentId: deptId,
        employeeRoles: { create: [{ roleId }] },
      },
    });

    const dto = await service.findById(employeeId);

    expect(dto?.assignedRoleId).toBe(roleId);
  });

  it("担当役割を持たない従業員は findById で assignedRoleId が null", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[1],
        email: "no-assigned-role@test.example.com",
        name: "担当役割なし従業員",
        departmentId: deptId,
      },
    });

    const dto = await service.findById(employeeId);

    expect(dto?.assignedRoleId).toBeNull();
  });

  it("findByEmployeeCd でも担当役割IDを返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[0],
        email: "assigned-role-bycd@test.example.com",
        name: "担当役割あり従業員CD",
        departmentId: deptId,
        employeeRoles: { create: [{ roleId }] },
      },
    });

    const dto = await service.findByEmployeeCd(TEST_EMP_CDS[0]);

    expect(dto?.assignedRoleId).toBe(roleId);
  });
});
