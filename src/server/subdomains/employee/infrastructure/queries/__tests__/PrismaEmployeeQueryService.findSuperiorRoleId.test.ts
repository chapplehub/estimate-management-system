import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * findSuperiorRoleId（承認チェーン組立て用の上位役割ID射影）の統合テスト（#417）。
 * 実 Prisma に対して検証する（モック禁止・testing-backend §1）。
 */
describe("PrismaEmployeeQueryService.findSuperiorRoleId", () => {
  // ファイル別プレフィックスで並列実行の P2002 を避ける（#327）。
  const TEST_EMP_CDS = ["EMP990110", "EMP990111"];
  const TEST_ROLE_CDS = ["ROLE911"];

  let service: PrismaEmployeeQueryService;
  let deptId: string;
  let superiorRoleId: string;

  async function cleanup() {
    await prisma.employee.deleteMany({ where: { employeeCd: { in: TEST_EMP_CDS } } });
    await prisma.role.deleteMany({ where: { roleCd: { in: TEST_ROLE_CDS } } });
  }

  beforeEach(async () => {
    await cleanup();
    deptId = await ensureTestDepartment();

    const kachou = await prisma.position.findUnique({ where: { positionCd: "POS001" } });
    superiorRoleId = generateId();
    await prisma.role.create({
      data: {
        id: superiorRoleId,
        roleCd: TEST_ROLE_CDS[0],
        name: "上位役割テスト",
        positionId: kachou!.id,
      },
    });

    service = new PrismaEmployeeQueryService();
  });

  afterEach(cleanup);

  it("上位役割を持つ従業員はその役割IDを返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[0],
        email: "superior-role@test.example.com",
        name: "上位役割あり従業員",
        departmentId: deptId,
        superiorRoleId,
      },
    });

    const result = await service.findSuperiorRoleId(employeeId);

    expect(result).toBe(superiorRoleId);
  });

  it("上位役割を持たない従業員は null を返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[1],
        email: "no-superior-role@test.example.com",
        name: "上位役割なし従業員",
        departmentId: deptId,
        superiorRoleId: null,
      },
    });

    const result = await service.findSuperiorRoleId(employeeId);

    expect(result).toBeNull();
  });
});
