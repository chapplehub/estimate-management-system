import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import type { UserRole } from "@server/shared/auth/types";
import { USER_ROLES } from "@server/shared/auth/types";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetEmployeeByIdQuery } from "../GetEmployeeByIdQuery";

describe("GetEmployeeByIdQuery", () => {
  let query: GetEmployeeByIdQuery;
  const testEmployeeIds: string[] = [];
  const testUserIds: string[] = [];

  const TEST_CODES = ["EMP999954"];
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

    const dept = await prisma.department.upsert({
      where: { departmentCd: "TEST_DEPT" },
      update: {},
      create: {
        id: generateId(),
        departmentCd: "TEST_DEPT",
        name: "テスト部署",
        abbreviation: "テスト",
        isActive: true,
      },
    });
    TEST_DEPT_ID = dept.id;

    query = new GetEmployeeByIdQuery(new PrismaEmployeeQueryService());
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    await prisma.employee.deleteMany({
      where: { id: { in: testEmployeeIds } },
    });
  });

  it("IDで従業員を取得できる", async () => {
    const { employeeId } = await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[0],
      email: "getbyid-query@example.com",
      name: "GetByIdQuery",
      role: USER_ROLES.USER,
    });

    const result = await query.execute({ id: employeeId });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(employeeId);
    expect(result?.employeeCd).toBe(TEST_CODES[0]);
    expect(result?.email).toBe("getbyid-query@example.com");
  });

  it("存在しないIDの場合nullを返す", async () => {
    const result = await query.execute({ id: "non-existent-id" });
    expect(result).toBeNull();
  });
});
