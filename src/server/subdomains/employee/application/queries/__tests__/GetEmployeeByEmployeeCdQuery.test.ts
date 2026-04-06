import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import type { UserRole } from "@server/shared/auth/types";
import { USER_ROLES } from "@server/shared/auth/types";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetEmployeeByEmployeeCdQuery } from "../GetEmployeeByEmployeeCdQuery";

describe("GetEmployeeByEmployeeCdQuery", () => {
  let query: GetEmployeeByEmployeeCdQuery;
  const testEmployeeIds: string[] = [];
  const testUserIds: string[] = [];

  const TEST_CODES = ["EMP999955"];
  let TEST_DEPT_ID: string;

  async function createTestEmployeeWithUser(data: {
    employeeCd: string;
    email: string;
    name: string;
    role: UserRole;
    departmentId?: string;
  }) {
    const employeeId = generateId();
    const userId = generateId();

    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: data.employeeCd,
        email: data.email,
        name: data.name,
        departmentId: data.departmentId ?? TEST_DEPT_ID,
      },
    });

    await prisma.user.create({
      data: {
        id: userId,
        email: data.email,
        name: data.name,
        employeeId: employeeId,
        role: data.role,
      },
    });

    testEmployeeIds.push(employeeId);
    testUserIds.push(userId);
    return { employeeId, userId };
  }

  beforeEach(async () => {
    testEmployeeIds.length = 0;
    testUserIds.length = 0;

    await prisma.user.deleteMany({
      where: { employee: { employeeCd: { in: TEST_CODES } } },
    });
    await prisma.employee.deleteMany({
      where: { employeeCd: { in: TEST_CODES } },
    });

    TEST_DEPT_ID = await ensureTestDepartment();

    query = new GetEmployeeByEmployeeCdQuery(new PrismaEmployeeQueryService());
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    await prisma.employee.deleteMany({
      where: { id: { in: testEmployeeIds } },
    });
  });

  it("従業員CDで従業員を取得できる", async () => {
    await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[0],
      email: "getbycd-query@example.com",
      name: "GetByCdQuery",
      role: USER_ROLES.USER,
    });

    const result = await query.execute({ employeeCd: TEST_CODES[0] });

    expect(result).not.toBeNull();
    expect(result?.employeeCd).toBe(TEST_CODES[0]);
    expect(result?.email).toBe("getbycd-query@example.com");
  });

  it("存在しない従業員CDの場合nullを返す", async () => {
    const result = await query.execute({ employeeCd: "EMP999999" });
    expect(result).toBeNull();
  });
});
