import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import type { UserRole } from "@server/shared/auth/types";
import { USER_ROLES } from "@server/shared/auth/types";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetEmployeeByEmailQuery } from "../GetEmployeeByEmailQuery";

describe("GetEmployeeByEmailQuery", () => {
  let query: GetEmployeeByEmailQuery;
  const testEmployeeIds: string[] = [];
  const testUserIds: string[] = [];

  const TEST_CODES = ["EMP999956"];
  let TEST_DEPT_ID: string;

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

    const dept = await prisma.department.upsert({
      where: { departmentCd: "TEST_DEPT" },
      update: {},
      create: {
        id: createId(),
        departmentCd: "TEST_DEPT",
        name: "テスト部署",
        abbreviation: "テスト",
        isActive: true,
      },
    });
    TEST_DEPT_ID = dept.id;

    query = new GetEmployeeByEmailQuery(new PrismaEmployeeQueryService());
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    await prisma.employee.deleteMany({
      where: { id: { in: testEmployeeIds } },
    });
  });

  it("メールアドレスで従業員を取得できる", async () => {
    await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[0],
      email: "getbyemail-query@example.com",
      name: "GetByEmailQuery",
      role: USER_ROLES.USER,
    });

    const result = await query.execute({ email: "getbyemail-query@example.com" });

    expect(result).not.toBeNull();
    expect(result?.email).toBe("getbyemail-query@example.com");
    expect(result?.employeeCd).toBe(TEST_CODES[0]);
  });

  it("存在しないメールアドレスの場合nullを返す", async () => {
    const result = await query.execute({ email: "nonexistent@example.com" });
    expect(result).toBeNull();
  });
});
