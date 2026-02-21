import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { PrismaDepartmentQueryService } from "@subdomains/department/infrastructure/queries/PrismaDepartmentQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetAllDepartmentsQuery } from "../GetAllDepartmentsQuery";

describe("GetAllDepartmentsQuery", () => {
  let query: GetAllDepartmentsQuery;
  const testDepartmentIds: string[] = [];

  const TEST_CODES = ["DEPT971", "DEPT972"];

  async function createTestDepartment(data: {
    departmentCd: string;
    name: string;
    abbreviation: string;
    displayOrder?: number;
    isActive?: boolean;
    parentId?: string | null;
  }): Promise<string> {
    const id = createId();
    await prisma.department.create({ data: { id, ...data } });
    testDepartmentIds.push(id);
    return id;
  }

  async function cleanup() {
    await prisma.department.deleteMany({
      where: { parentId: { not: null }, departmentCd: { in: TEST_CODES } },
    });
    await prisma.department.deleteMany({
      where: { departmentCd: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    testDepartmentIds.length = 0;
    await cleanup();

    query = new GetAllDepartmentsQuery(new PrismaDepartmentQueryService());
  });

  afterEach(async () => {
    await cleanup();
  });

  it("全部署を取得できる", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "全取得テスト部署1",
      abbreviation: "全取得1",
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "全取得テスト部署2",
      abbreviation: "全取得2",
    });

    const result = await query.execute({});

    expect(result.length).toBeGreaterThanOrEqual(2);
    const departmentCds = result.map((r) => r.departmentCd);
    expect(departmentCds).toContain(TEST_CODES[0]);
    expect(departmentCds).toContain(TEST_CODES[1]);
  });

  it("limitを指定して取得できる", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "全取得テスト部署1",
      abbreviation: "全取得1",
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "全取得テスト部署2",
      abbreviation: "全取得2",
    });

    const result = await query.execute({ options: { limit: 1 } });

    expect(result.length).toBe(1);
  });

  it("ソート順を指定して取得できる", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "全取得テスト部署1",
      abbreviation: "全取得1",
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "全取得テスト部署2",
      abbreviation: "全取得2",
    });

    const result = await query.execute({
      options: { orderBy: { field: "departmentCd", direction: "asc" } },
    });

    expect(result.length).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].departmentCd <= result[i + 1].departmentCd).toBe(true);
    }
  });
});
