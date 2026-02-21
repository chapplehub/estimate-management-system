import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { PrismaDepartmentQueryService } from "@subdomains/department/infrastructure/queries/PrismaDepartmentQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetActiveDepartmentsQuery } from "../GetActiveDepartmentsQuery";

describe("GetActiveDepartmentsQuery", () => {
  let query: GetActiveDepartmentsQuery;
  const testDepartmentIds: string[] = [];

  const TEST_CODES = ["DEPT977", "DEPT978"];

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

    query = new GetActiveDepartmentsQuery(new PrismaDepartmentQueryService());
  });

  afterEach(async () => {
    await cleanup();
  });

  it("有効な部署のみ取得できる", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "有効部署",
      abbreviation: "有効",
      isActive: true,
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "無効部署",
      abbreviation: "無効",
      isActive: false,
    });

    const result = await query.execute({});

    const departmentCds = result.map((r) => r.departmentCd);
    expect(departmentCds).toContain(TEST_CODES[0]);
    expect(departmentCds).not.toContain(TEST_CODES[1]);
  });

  it("オプション付きで取得できる", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "有効部署1",
      abbreviation: "有効1",
      isActive: true,
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "有効部署2",
      abbreviation: "有効2",
      isActive: true,
    });

    const result = await query.execute({ options: { limit: 1 } });

    expect(result.length).toBe(1);
  });
});
