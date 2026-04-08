import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import { ProductCategory, ProductUnit } from "@generated/prisma/client";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchProductsQuery } from "../SearchProductsQuery";

describe("SearchProductsQuery", () => {
  let query: SearchProductsQuery;
  const testProductIds: string[] = [];

  const TEST_CODES = ["PROD999924", "PROD999925", "PROD999926", "PROD999927"];

  async function createTestProduct(data: {
    code: string;
    name: string;
    category?: ProductCategory;
    unit?: ProductUnit;
    costPrice?: number;
    isActive?: boolean;
  }) {
    const productId = generateId();

    await prisma.product.create({
      data: {
        id: productId,
        code: data.code,
        name: data.name,
        category: data.category ?? ProductCategory.INDIVIDUAL,
        unit: data.unit ?? ProductUnit.UNIT,
        costPrice: data.costPrice ?? null,
        isActive: data.isActive ?? true,
      },
    });

    testProductIds.push(productId);
    return { productId };
  }

  beforeEach(async () => {
    testProductIds.length = 0;

    await prisma.product.deleteMany({
      where: { code: { in: TEST_CODES } },
    });

    query = new SearchProductsQuery(new PrismaProductQueryService());
  });

  afterEach(async () => {
    if (testProductIds.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: testProductIds } },
      });
    }
  });

  it("名前で検索できる（部分一致）", async () => {
    await createTestProduct({ code: TEST_CODES[0], name: "SQ検索商品A" });
    await createTestProduct({ code: TEST_CODES[1], name: "SQ検索商品B" });

    const result = await query.execute({ name: "SQ検索商品" });

    expect(result.length).toBe(2);
    const names = result.map((r) => r.name);
    expect(names).toContain("SQ検索商品A");
    expect(names).toContain("SQ検索商品B");
  });

  it("名前で検索してヒットしない場合は空配列を返す", async () => {
    await createTestProduct({ code: TEST_CODES[0], name: "SQ検索商品A" });

    const result = await query.execute({ name: "該当なしSQ名前" });

    expect(result).toEqual([]);
  });

  it("コードで検索できる（部分一致）", async () => {
    await createTestProduct({ code: TEST_CODES[0], name: "コード検索A" });
    await createTestProduct({ code: TEST_CODES[1], name: "コード検索B" });

    const result = await query.execute({ code: "PROD9999" });

    expect(result.length).toBe(2);
  });

  it("コードで検索してヒットしない場合は空配列を返す", async () => {
    await createTestProduct({ code: TEST_CODES[0], name: "コード検索A" });

    const result = await query.execute({ code: "NONEXIST999" });

    expect(result).toEqual([]);
  });

  it("商品区分で検索できる", async () => {
    await createTestProduct({
      code: TEST_CODES[0],
      name: "SQ区分検索個別",
      category: ProductCategory.INDIVIDUAL,
    });
    await createTestProduct({
      code: TEST_CODES[1],
      name: "SQ区分検索消耗品",
      category: ProductCategory.CONSUMABLE,
    });

    const result = await query.execute({
      name: "SQ区分検索",
      category: ProductCategory.INDIVIDUAL,
    });

    expect(result.length).toBe(1);
    expect(result[0].category).toBe(ProductCategory.INDIVIDUAL);
  });

  it("isActiveで検索できる", async () => {
    await createTestProduct({
      code: TEST_CODES[0],
      name: "SQアクティブ商品A",
      isActive: true,
    });
    await createTestProduct({
      code: TEST_CODES[1],
      name: "SQアクティブ商品B",
      isActive: false,
    });

    const activeResult = await query.execute({ name: "SQアクティブ商品", isActive: true });
    expect(activeResult.length).toBe(1);
    expect(activeResult[0].code).toBe(TEST_CODES[0]);

    const inactiveResult = await query.execute({ name: "SQアクティブ商品", isActive: false });
    expect(inactiveResult.length).toBe(1);
    expect(inactiveResult[0].code).toBe(TEST_CODES[1]);
  });

  it("複数条件を組み合わせて検索できる", async () => {
    await createTestProduct({
      code: TEST_CODES[0],
      name: "複合検索商品A",
      isActive: true,
    });
    await createTestProduct({
      code: TEST_CODES[1],
      name: "複合検索商品B",
      isActive: false,
    });
    await createTestProduct({
      code: TEST_CODES[2],
      name: "別名商品C",
      isActive: true,
    });

    const result = await query.execute({
      name: "複合検索",
      code: TEST_CODES[0],
      isActive: true,
    });

    expect(result.length).toBe(1);
    expect(result[0].code).toBe(TEST_CODES[0]);
    expect(result[0].name).toBe("複合検索商品A");
  });
});
