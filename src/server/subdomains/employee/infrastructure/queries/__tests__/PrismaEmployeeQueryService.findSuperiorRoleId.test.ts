import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * findSuperiorRoleId（承認チェーン組立て用の上位役割ID射影）の統合テスト（#417 / #567）。
 * 実 Prisma に対して検証する（モック禁止・testing-backend §1）。
 *
 * ADR-20260707-k4e により、上位役割は列に持たず読み取り時導出する：
 *   担当役割あり → その担当役割の上位役割（役割階層の1段上）
 *   担当役割なし（課員）→ EmployeeSuperiorRole の明示値
 *   どちらも無     → null
 * このメソッドが承認起点の唯一の消費点で、estimate 側は本導出を意識しない。
 */
describe("PrismaEmployeeQueryService.findSuperiorRoleId", () => {
  // ファイル別プレフィックスで並列実行の P2002 を避ける（#327）。
  const TEST_EMP_CDS = ["EMP990110", "EMP990111", "EMP990112", "EMP990113"];
  const TEST_ROLE_CDS = ["ROLE911", "ROLE912", "ROLE913"];

  let service: PrismaEmployeeQueryService;
  let deptId: string;

  let assignedRoleId: string; // 課長級。上位役割 = seniorRoleId を持つ
  let seniorRoleId: string; // 部長級。assignedRole の上位役割
  let explicitRoleId: string; // 課員の明示上位役割（課長級）

  async function cleanup() {
    // 従業員削除で employeeRole / employeeSuperiorRole 子行は CASCADE される
    await prisma.employee.deleteMany({ where: { employeeCd: { in: TEST_EMP_CDS } } });
    await prisma.role.deleteMany({ where: { roleCd: { in: TEST_ROLE_CDS } } });
  }

  beforeEach(async () => {
    await cleanup();
    deptId = await ensureTestDepartment();

    const [kachou, buchou] = await Promise.all([
      prisma.position.findUnique({ where: { positionCd: "POS001" } }),
      prisma.position.findUnique({ where: { positionCd: "POS002" } }),
    ]);

    // 部長級の上位役割 → 課長級の担当役割 → 課員の明示役割 の順に用意する
    seniorRoleId = generateId();
    assignedRoleId = generateId();
    explicitRoleId = generateId();
    await prisma.role.create({
      data: {
        id: seniorRoleId,
        roleCd: TEST_ROLE_CDS[1],
        name: "上位役割（部長級）",
        positionId: buchou!.id,
      },
    });
    await prisma.role.create({
      data: {
        id: assignedRoleId,
        roleCd: TEST_ROLE_CDS[0],
        name: "担当役割（課長級）",
        positionId: kachou!.id,
        superiorRoleId: seniorRoleId,
      },
    });
    await prisma.role.create({
      data: {
        id: explicitRoleId,
        roleCd: TEST_ROLE_CDS[2],
        name: "課員の明示上位役割（課長級）",
        positionId: kachou!.id,
      },
    });

    service = new PrismaEmployeeQueryService();
  });

  afterEach(cleanup);

  it("担当役割を持つ従業員は、その担当役割の上位役割IDを返す（読み取り時導出）", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[0],
        email: "role-holder@test.example.com",
        name: "役割持ち従業員",
        departmentId: deptId,
        employeeRoles: { create: [{ roleId: assignedRoleId }] },
      },
    });

    const result = await service.findSuperiorRoleId(employeeId);

    expect(result).toBe(seniorRoleId);
  });

  it("担当役割を持たない課員で明示上位役割ありは、その明示役割IDを返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[1],
        email: "explicit-superior@test.example.com",
        name: "明示上位役割あり課員",
        departmentId: deptId,
        superiorRole: { create: { roleId: explicitRoleId } },
      },
    });

    const result = await service.findSuperiorRoleId(employeeId);

    expect(result).toBe(explicitRoleId);
  });

  it("担当役割も明示上位役割も持たない従業員は null を返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[2],
        email: "no-superior@test.example.com",
        name: "上位役割なし従業員",
        departmentId: deptId,
      },
    });

    const result = await service.findSuperiorRoleId(employeeId);

    expect(result).toBeNull();
  });

  it("担当役割はあるがその役割に上位役割がない場合は null を返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[3],
        email: "top-role@test.example.com",
        name: "上位役割なし役割の保有者",
        departmentId: deptId,
        // seniorRoleId 自身は superiorRoleId を持たない（役割階層の頂点扱い）
        employeeRoles: { create: [{ roleId: seniorRoleId }] },
      },
    });

    const result = await service.findSuperiorRoleId(employeeId);

    expect(result).toBeNull();
  });
});
