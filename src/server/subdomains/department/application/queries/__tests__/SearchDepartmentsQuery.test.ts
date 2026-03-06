import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { PrismaDepartmentQueryService } from "@subdomains/department/infrastructure/queries/PrismaDepartmentQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchDepartmentsQuery } from "../SearchDepartmentsQuery";

describe("SearchDepartmentsQuery", () => {
  let query: SearchDepartmentsQuery;
  const testDepartmentIds: string[] = [];

  const TEST_CODES = ["DEPT979", "DEPT980", "DEPT981", "DEPT982"];

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

    query = new SearchDepartmentsQuery(new PrismaDepartmentQueryService());
  });

  afterEach(async () => {
    await cleanup();
  });

  it("部署名で部分一致検索できる", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "SQ第一営業部",
      abbreviation: "SQ一営",
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "SQ開発部",
      abbreviation: "SQ開発",
    });

    const result = await query.execute({
      criteria: { name: "営業" },
    });

    const departmentCds = result.map((r) => r.departmentCd);
    expect(departmentCds).toContain(TEST_CODES[0]);
    expect(departmentCds).not.toContain(TEST_CODES[1]);
  });

  it("部署名が一致しない場合は検索結果に含まれない", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "SQ第一営業部",
      abbreviation: "SQ一営",
    });

    const result = await query.execute({
      criteria: { name: "総務" },
    });

    const departmentCds = result.map((r) => r.departmentCd);
    expect(departmentCds).not.toContain(TEST_CODES[0]);
  });

  it("略称で部分一致検索できる", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "SQ略称検索部署A",
      abbreviation: "SQ略称ターゲット",
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "SQ略称検索部署B",
      abbreviation: "SQ略称その他",
    });

    const result = await query.execute({
      criteria: { abbreviation: "ターゲット" },
    });

    const departmentCds = result.map((r) => r.departmentCd);
    expect(departmentCds).toContain(TEST_CODES[0]);
    expect(departmentCds).not.toContain(TEST_CODES[1]);
  });

  it("略称が一致しない場合は検索結果に含まれない", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "SQ略称検索部署A",
      abbreviation: "SQ略称ターゲット",
    });

    const result = await query.execute({
      criteria: { abbreviation: "該当なし" },
    });

    const departmentCds = result.map((r) => r.departmentCd);
    expect(departmentCds).not.toContain(TEST_CODES[0]);
  });

  it("部署コードで検索できる", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "検索コード部署",
      abbreviation: "検索CD",
    });

    const result = await query.execute({
      criteria: { departmentCd: TEST_CODES[0] },
    });

    expect(result.length).toBe(1);
    expect(result[0].departmentCd).toBe(TEST_CODES[0]);
  });

  it("部署コードは完全一致検索のため部分一致ではヒットしない", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "検索コード部署",
      abbreviation: "検索CD",
    });

    const result = await query.execute({
      criteria: { departmentCd: "DEPT97" },
    });

    const departmentCds = result.map((r) => r.departmentCd);
    expect(departmentCds).not.toContain(TEST_CODES[0]);
  });

  it("有効フラグで検索できる", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "SQ有効部署",
      abbreviation: "SQ有効",
      isActive: true,
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "SQ無効部署",
      abbreviation: "SQ無効",
      isActive: false,
    });

    const result = await query.execute({
      criteria: { isActive: true, name: "SQ" },
    });

    const departmentCds = result.map((r) => r.departmentCd);
    expect(departmentCds).toContain(TEST_CODES[0]);
    expect(departmentCds).not.toContain(TEST_CODES[1]);
  });

  it("検索条件とオプションを組み合わせて検索できる", async () => {
    await createTestDepartment({
      departmentCd: TEST_CODES[0],
      name: "SQオプ検索部署A",
      abbreviation: "SQオプA",
    });
    await createTestDepartment({
      departmentCd: TEST_CODES[1],
      name: "SQオプ検索部署B",
      abbreviation: "SQオプB",
    });

    const result = await query.execute({
      criteria: { name: "SQオプ検索" },
      options: { limit: 1, orderBy: { field: "departmentCd", direction: "asc" } },
    });

    expect(result.length).toBe(1);
  });

  it("条件に一致する部署がない場合は空配列を返す", async () => {
    const result = await query.execute({
      criteria: { name: "存在しないSQ部署名" },
    });

    expect(result).toEqual([]);
  });

  describe("executeWithPagination", () => {
    beforeEach(async () => {
      await createTestDepartment({
        departmentCd: TEST_CODES[0],
        name: "SQページ部署A",
        abbreviation: "SQページA",
      });
      await createTestDepartment({
        departmentCd: TEST_CODES[1],
        name: "SQページ部署B",
        abbreviation: "SQページB",
      });
      await createTestDepartment({
        departmentCd: TEST_CODES[2],
        name: "SQページ部署C",
        abbreviation: "SQページC",
      });
    });

    it("正常にページネーション結果を返す", async () => {
      const result = await query.executeWithPagination({
        criteria: { name: "SQページ部署" },
        pagination: { page: 1, pageSize: 2 },
        orderBy: { field: "departmentCd", direction: "asc" },
      });

      expect(result.items.length).toBe(2);
      expect(result.totalCount).toBe(3);
      expect(result.totalPages).toBe(2);
      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPreviousPage).toBe(false);
    });

    it("2ページ目を取得できる", async () => {
      const result = await query.executeWithPagination({
        criteria: { name: "SQページ部署" },
        pagination: { page: 2, pageSize: 2 },
        orderBy: { field: "departmentCd", direction: "asc" },
      });

      expect(result.items.length).toBe(1);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(true);
    });

    it("ページ範囲外の場合は空配列を返す", async () => {
      const result = await query.executeWithPagination({
        criteria: { name: "SQページ部署" },
        pagination: { page: 99, pageSize: 2 },
      });

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(3);
      expect(result.hasNextPage).toBe(false);
    });

    it("0件の場合のページネーション", async () => {
      const result = await query.executeWithPagination({
        criteria: { name: "存在しないSQページ部署名" },
        pagination: { page: 1, pageSize: 10 },
      });

      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPreviousPage).toBe(false);
    });
  });
});
