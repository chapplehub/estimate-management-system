import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * 読み取り DTO への明示上位役割ID（explicitSuperiorRoleId）射影の統合テスト（#567）。
 * 登録・更新画面の現在値復元（課員の上位役割 preselect）に使う。
 * 実 Prisma に対して検証する（モック禁止・ADR-0012）。
 *
 * 承認起点の導出 findSuperiorRoleId とは別読み：
 *   課員（担当役割なし）で明示行あり → その明示役割ID
 *   役割持ち（I1 により明示行を持たない） → null
 *   どちらも無 → null
 */
describe("PrismaEmployeeQueryService 明示上位役割ID(explicitSuperiorRoleId)", () => {
  // ファイル別プレフィックスで並列実行の P2002 を避ける（#327）。
  const TEST_EMP_CDS = ["EMP990610", "EMP990611", "EMP990612"];
  const TEST_ROLE_CDS = ["ROLE961", "ROLE962"];

  let service: PrismaEmployeeQueryService;
  let deptId: string;
  let assignedRoleId: string; // 担当役割（課長級）
  let explicitRoleId: string; // 課員の明示上位役割（課長級）

  async function cleanup() {
    // 従業員削除で employeeRole / employeeSuperiorRole 子行は CASCADE される
    await prisma.employee.deleteMany({ where: { employeeCd: { in: TEST_EMP_CDS } } });
    await prisma.role.deleteMany({ where: { roleCd: { in: TEST_ROLE_CDS } } });
  }

  beforeEach(async () => {
    await cleanup();
    deptId = await ensureTestDepartment();

    const kachou = await prisma.position.findUnique({ where: { positionCd: "POS001" } });
    assignedRoleId = generateId();
    explicitRoleId = generateId();
    await prisma.role.create({
      data: {
        id: assignedRoleId,
        roleCd: TEST_ROLE_CDS[0],
        name: "担当役割（課長級）",
        positionId: kachou!.id,
      },
    });
    await prisma.role.create({
      data: {
        id: explicitRoleId,
        roleCd: TEST_ROLE_CDS[1],
        name: "明示上位役割（課長級）",
        positionId: kachou!.id,
      },
    });

    service = new PrismaEmployeeQueryService();
  });

  afterEach(cleanup);

  it("明示上位役割を持つ課員は findById で explicitSuperiorRoleId を返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[0],
        email: "explicit-superior@test.example.com",
        name: "明示上位役割あり課員",
        departmentId: deptId,
        superiorRole: { create: { roleId: explicitRoleId } },
      },
    });

    const dto = await service.findById(employeeId);

    expect(dto?.explicitSuperiorRoleId).toBe(explicitRoleId);
  });

  it("担当役割を持つ従業員は explicitSuperiorRoleId が null（I1 により明示行を持たない）", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[1],
        email: "role-holder-no-explicit@test.example.com",
        name: "役割持ち従業員",
        departmentId: deptId,
        employeeRoles: { create: [{ roleId: assignedRoleId }] },
      },
    });

    const dto = await service.findById(employeeId);

    expect(dto?.explicitSuperiorRoleId).toBeNull();
  });

  it("担当役割も明示上位役割も持たない従業員は explicitSuperiorRoleId が null", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[2],
        email: "no-superior-at-all@test.example.com",
        name: "上位役割なし従業員",
        departmentId: deptId,
      },
    });

    const dto = await service.findById(employeeId);

    expect(dto?.explicitSuperiorRoleId).toBeNull();
  });

  it("findByEmployeeCd でも明示上位役割IDを返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[0],
        email: "explicit-superior-bycd@test.example.com",
        name: "明示上位役割あり課員CD",
        departmentId: deptId,
        superiorRole: { create: { roleId: explicitRoleId } },
      },
    });

    const dto = await service.findByEmployeeCd(TEST_EMP_CDS[0]);

    expect(dto?.explicitSuperiorRoleId).toBe(explicitRoleId);
  });
});
