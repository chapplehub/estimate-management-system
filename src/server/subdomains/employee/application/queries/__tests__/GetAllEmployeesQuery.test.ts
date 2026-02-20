import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import type { UserRole } from "@server/shared/auth/types";
import { USER_ROLES } from "@server/shared/auth/types";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetAllEmployeesQuery } from "../GetAllEmployeesQuery";

describe("GetAllEmployeesQuery", () => {
  let query: GetAllEmployeesQuery;
  const testEmployeeIds: string[] = [];
  const testUserIds: string[] = [];

  const TEST_CODES = ["EMP999961", "EMP999962"];

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

    query = new GetAllEmployeesQuery(new PrismaEmployeeQueryService());
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    await prisma.employee.deleteMany({
      where: { id: { in: testEmployeeIds } },
    });
  });

  it("全従業員を取得できる", async () => {
    await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[0],
      email: "getall-q1@example.com",
      name: "全取得Query1",
      role: USER_ROLES.USER,
    });
    await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[1],
      email: "getall-q2@example.com",
      name: "全取得Query2",
      role: USER_ROLES.ADMIN,
    });

    const result = await query.execute({});

    expect(result.length).toBeGreaterThanOrEqual(2);
    const employeeCds = result.map((r) => r.employeeCd);
    expect(employeeCds).toContain(TEST_CODES[0]);
    expect(employeeCds).toContain(TEST_CODES[1]);
  });

  it("limit/offset付きで取得できる", async () => {
    await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[0],
      email: "getall-q3@example.com",
      name: "全取得Query3",
      role: USER_ROLES.USER,
    });
    await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[1],
      email: "getall-q4@example.com",
      name: "全取得Query4",
      role: USER_ROLES.USER,
    });

    const result = await query.execute({ options: { limit: 1 } });

    expect(result.length).toBe(1);
  });

  it("ソート順を指定して取得できる", async () => {
    await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[0],
      email: "getall-q5@example.com",
      name: "全取得Query5",
      role: USER_ROLES.USER,
    });
    await createTestEmployeeWithUser({
      employeeCd: TEST_CODES[1],
      email: "getall-q6@example.com",
      name: "全取得Query6",
      role: USER_ROLES.USER,
    });

    const result = await query.execute({
      options: { orderBy: { field: "employeeCd", direction: "asc" } },
    });

    expect(result.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].employeeCd <= result[i + 1].employeeCd).toBe(true);
    }
  });
});
