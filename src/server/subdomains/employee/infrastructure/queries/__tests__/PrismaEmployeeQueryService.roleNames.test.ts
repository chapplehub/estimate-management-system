import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import { roleTestCodes } from "@server/__tests__/helpers/test-codes/roleTestCodes";
import { employeeTestCodes } from "@server/__tests__/helpers/test-codes/employeeTestCodes";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * 読み取り DTO への役割名射影（assignedRoleName / superiorRoleName）の統合テスト（#578）。
 * 一覧の担当役割列・上位役割列の表示に用いる（案B・ADR-0013）。
 * 実 Prisma に対して検証する（モック禁止・ADR-0012）。
 *
 * superiorRoleName は findSuperiorRoleId と同じ導出分岐を名前解決したもの（承認起点とは別読み）：
 *   担当役割あり → その担当役割の上位役割名
 *   担当役割なし（課員）→ 明示上位役割名
 *   どちらも無     → null
 */
describe("PrismaEmployeeQueryService 役割名(assignedRoleName / superiorRoleName)", () => {
  // コード割当はレジストリを唯一のソースとする（#608 / ADR 20260715-f71）。二重占有は TS1117。
  const TEST_EMP_CDS = employeeTestCodes["employee.roleNames"].codes;
  const TEST_ROLE_CDS = roleTestCodes["employee.roleNames"].codes;

  let service: PrismaEmployeeQueryService;
  let deptId: string;

  let seniorRoleId: string; // 部長級。assignedRole の上位役割
  let assignedRoleId: string; // 課長級。上位役割 = seniorRoleId を持つ
  let leafRoleId: string; // 課長級。上位役割を持たない（担当役割にも明示上位役割にも使う）

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

    // 部長級（上位役割）→ 課長級（担当役割・上位あり）→ 課長級（上位なし）の順に用意する
    seniorRoleId = generateId();
    assignedRoleId = generateId();
    leafRoleId = generateId();
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
        id: leafRoleId,
        roleCd: TEST_ROLE_CDS[2],
        name: "上位なし役割（課長級）",
        positionId: kachou!.id,
      },
    });

    service = new PrismaEmployeeQueryService();
  });

  afterEach(cleanup);

  it("担当役割を持つ従業員は担当役割名と、その役割の上位役割名を返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[0],
        email: `${TEST_EMP_CDS[0]}@test.example.com`,
        name: "担当役割あり従業員",
        departmentId: deptId,
        employeeRoles: { create: [{ roleId: assignedRoleId }] },
      },
    });

    const dto = await service.findById(employeeId);

    expect(dto?.assignedRoleName).toBe("担当役割（課長級）");
    expect(dto?.superiorRoleName).toBe("上位役割（部長級）");
  });

  it("明示上位役割を持つ課員は担当役割名が null、上位役割名は明示役割名を返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[1],
        email: `${TEST_EMP_CDS[1]}@test.example.com`,
        name: "明示上位役割あり課員",
        departmentId: deptId,
        superiorRole: { create: { roleId: leafRoleId } },
      },
    });

    const dto = await service.findById(employeeId);

    expect(dto?.assignedRoleName).toBeNull();
    expect(dto?.superiorRoleName).toBe("上位なし役割（課長級）");
  });

  it("担当役割はあるが上位役割を持たない従業員は担当役割名を返し、上位役割名は null", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[2],
        email: `${TEST_EMP_CDS[2]}@test.example.com`,
        name: "上位役割なし役割持ち従業員",
        departmentId: deptId,
        employeeRoles: { create: [{ roleId: leafRoleId }] },
      },
    });

    const dto = await service.findById(employeeId);

    expect(dto?.assignedRoleName).toBe("上位なし役割（課長級）");
    expect(dto?.superiorRoleName).toBeNull();
  });

  it("担当役割も明示上位役割も持たない従業員は両方 null", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[3],
        email: `${TEST_EMP_CDS[3]}@test.example.com`,
        name: "役割なし従業員",
        departmentId: deptId,
      },
    });

    const dto = await service.findById(employeeId);

    expect(dto?.assignedRoleName).toBeNull();
    expect(dto?.superiorRoleName).toBeNull();
  });

  it("search（一覧経路）でも役割名を返す", async () => {
    const employeeId = generateId();
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: TEST_EMP_CDS[0],
        email: `${TEST_EMP_CDS[0]}-search@test.example.com`,
        name: "一覧経路検証従業員",
        departmentId: deptId,
        employeeRoles: { create: [{ roleId: assignedRoleId }] },
      },
    });

    const results = await service.search({ employeeCd: TEST_EMP_CDS[0] });
    const dto = results.find((e) => e.employeeCd === TEST_EMP_CDS[0]);

    expect(dto?.assignedRoleName).toBe("担当役割（課長級）");
    expect(dto?.superiorRoleName).toBe("上位役割（部長級）");
  });
});
