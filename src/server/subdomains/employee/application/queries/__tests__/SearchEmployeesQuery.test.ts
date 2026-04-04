import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import type { UserRole } from "@server/shared/auth/types";
import { USER_ROLES } from "@server/shared/auth/types";
import { PrismaEmployeeQueryService } from "@subdomains/employee/infrastructure/queries/PrismaEmployeeQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchEmployeesQuery } from "../SearchEmployeesQuery";

describe("SearchEmployeesQuery", () => {
  let query: SearchEmployeesQuery;
  const testEmployeeIds: string[] = [];
  const testUserIds: string[] = [];

  const TEST_CODES = ["EMP999957", "EMP999958", "EMP999959", "EMP999960"];
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

    query = new SearchEmployeesQuery(new PrismaEmployeeQueryService());
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
    await prisma.employee.deleteMany({
      where: { id: { in: testEmployeeIds } },
    });
  });

  describe("execute", () => {
    it("検索条件で従業員を検索できる", async () => {
      await createTestEmployeeWithUser({
        employeeCd: TEST_CODES[0],
        email: "search-q1@example.com",
        name: "SQ検索者A",
        role: USER_ROLES.USER,
      });

      const result = await query.execute({
        criteria: { name: "SQ検索者A" },
      });

      expect(result.length).toBe(1);
      expect(result[0].name).toBe("SQ検索者A");
    });

    it("検索条件とオプションを指定して検索できる", async () => {
      await createTestEmployeeWithUser({
        employeeCd: TEST_CODES[0],
        email: "search-q2@example.com",
        name: "SQ検索者B",
        role: USER_ROLES.USER,
      });
      await createTestEmployeeWithUser({
        employeeCd: TEST_CODES[1],
        email: "search-q3@example.com",
        name: "SQ検索者C",
        role: USER_ROLES.USER,
      });

      const result = await query.execute({
        criteria: { name: "SQ検索者" },
        options: { limit: 1, orderBy: { field: "employeeCd", direction: "asc" } },
      });

      expect(result.length).toBe(1);
    });

    it("条件に一致する従業員がいない場合は空配列を返す", async () => {
      const result = await query.execute({
        criteria: { name: "存在しないSQ名前" },
      });

      expect(result).toEqual([]);
    });
  });
});
