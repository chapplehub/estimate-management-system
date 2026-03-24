import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { PrismaDepartmentQueryService } from "@subdomains/department/infrastructure/queries/PrismaDepartmentQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetDepartmentTreeQuery } from "../GetDepartmentTreeQuery";

describe("GetDepartmentTreeQuery", () => {
  let query: GetDepartmentTreeQuery;
  const testDepartmentIds: string[] = [];

  const TEST_CODES = ["DEPT974", "DEPT975", "DEPT976"];

  async function createTestDepartment(data: {
    departmentCd: string;
    name: string;
    abbreviation: string;
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

    query = new GetDepartmentTreeQuery(new PrismaDepartmentQueryService());
  });

  afterEach(async () => {
    await cleanup();
  });

  it("部署ツリーを取得できる", async () => {
    const rootId = await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "ルート部署",
      abbreviation: "ルート",
      isActive: true,
    });
    const childId = await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "子部署",
      abbreviation: "子",
      isActive: true,
      parentId: rootId,
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[2],
      name: "孫部署",
      abbreviation: "孫",
      isActive: true,
      parentId: childId,
    });

    const result = await query.execute({});

    const rootNode = result.find((r) => r.departmentCd === TEST_CODES[0]);
    expect(rootNode).not.toBeUndefined();
    expect(rootNode?.children.length).toBeGreaterThanOrEqual(1);

    const childNode = rootNode?.children.find((c) => c.departmentCd === TEST_CODES[1]);
    expect(childNode).not.toBeUndefined();
    expect(childNode?.children.length).toBeGreaterThanOrEqual(1);

    const grandchildNode = childNode?.children.find((c) => c.departmentCd === TEST_CODES[2]);
    expect(grandchildNode).not.toBeUndefined();
  });

  it("指定したルートIDからツリーを取得できる", async () => {
    const rootId = await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "ルート部署",
      abbreviation: "ルート",
      isActive: true,
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "子部署",
      abbreviation: "子",
      isActive: true,
      parentId: rootId,
    });

    const result = await query.execute({ rootId });

    // getTree(rootId)はrootIdの子を返す
    expect(result.length).toBeGreaterThanOrEqual(1);
    const childNode = result.find((r) => r.departmentCd === TEST_CODES[1]);
    expect(childNode).not.toBeUndefined();
  });

  it("無効な部署はツリーに含まれない", async () => {
    const rootId = await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "有効ルート部署",
      abbreviation: "有効ルート",
      isActive: true,
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "無効子部署",
      abbreviation: "無効子",
      isActive: false,
      parentId: rootId,
    });

    const result = await query.execute({});

    const rootNode = result.find((r) => r.departmentCd === TEST_CODES[0]);
    expect(rootNode).not.toBeUndefined();

    const inactiveChild = rootNode?.children.find((c) => c.departmentCd === TEST_CODES[1]);
    expect(inactiveChild).toBeUndefined();
  });
});
