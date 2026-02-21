import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { PrismaDepartmentQueryService } from "@subdomains/department/infrastructure/queries/PrismaDepartmentQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetDepartmentByIdQuery } from "../GetDepartmentByIdQuery";

describe("GetDepartmentByIdQuery", () => {
  let query: GetDepartmentByIdQuery;
  const testDepartmentIds: string[] = [];

  const TEST_CODES = ["DEPT973"];

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

    query = new GetDepartmentByIdQuery(new PrismaDepartmentQueryService());
  });

  afterEach(async () => {
    await cleanup();
  });

  it("IDで部署を取得できる", async () => {
    const deptId = await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "取得テスト部署",
      abbreviation: "取得テスト",
      displayOrder: 5,
    });

    const result = await query.execute({ id: deptId });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(deptId);
    expect(result?.departmentCd).toBe(TEST_CODES[0]);
    expect(result?.name).toBe("取得テスト部署");
    expect(result?.abbreviation).toBe("取得テスト");
    expect(result?.displayOrder).toBe(5);
    expect(result?.isActive).toBe(true);
    expect(result?.parentId).toBeNull();
  });

  it("存在しないIDの場合nullを返す", async () => {
    const result = await query.execute({ id: "non-existent-id" });
    expect(result).toBeNull();
  });
});
