import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import type { UserRole } from "@server/shared/auth/types";
import { USER_ROLES } from "@server/shared/auth/types";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CountEmployeesQuery } from "../CountEmployeesQuery";

describe("CountEmployeesQuery", () => {
  let query: CountEmployeesQuery;
  const testEmployeeIds: string[] = [];
  const testUserIds: string[] = [];

  const TEST_CODES = ["EMP999951", "EMP999952", "EMP999953"];

  async function createTestEmployeeWithUser(data: {
    employeeCd: string;
    email: string;
    name: string;
    role: UserRole;
    departmentId?: string;
  }) {
    const employeeId = createId();
    const userId = createId();

    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: data.employeeCd,
        email: data.email,
        name: data.name,
        departmentId: data.departmentId ?? "dept-001",
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

    await prisma.department.upsert({
      where: { id: "dept-001" },
      update: {},
      create: {
        id: "dept-001",
        departmentCd: "DEPT001",
        name: "テスト部署",
        abbreviation: "テスト",
        displayOrder: 1,
        isActive: true,
      },
    });

    query = new CountEmployeesQuery(new PrismaEmployeeQueryService());
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    await prisma.employee.deleteMany({
      where: { id: { in: testEmployeeIds } },
    });
  });

  it("全従業員数をカウントできる", async () => {
    await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[0],
      email: "count-query1@example.com",
      name: "カウントQuery1",
      role: USER_ROLES.USER,
    });

    const result = await query.execute({ criteria: {} });
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it("条件に一致する従業員数をカウントできる", async () => {
    await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[0],
      email: "count-query2@example.com",
      name: "カウントQuery2",
      role: USER_ROLES.ADMIN,
    });

    const result = await query.execute({
      criteria: { role: USER_ROLES.ADMIN },
    });
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it("条件に一致する従業員がいない場合は0を返す", async () => {
    const result = await query.execute({
      criteria: { name: "存在しないカウント名前" },
    });
    expect(result).toBe(0);
  });
});
