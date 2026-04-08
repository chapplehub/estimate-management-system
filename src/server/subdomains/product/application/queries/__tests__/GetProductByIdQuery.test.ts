import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import { ProductCategory, ProductUnit } from "@generated/prisma/client";
import { PrismaProductQueryService } from "@subdomains/product/infrastructure/queries/PrismaProductQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetProductByIdQuery } from "../GetProductByIdQuery";

describe("GetProductByIdQuery", () => {
  let query: GetProductByIdQuery;
  const testProductIds: string[] = [];

  const TEST_CODES = ["PROD999923"];

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

    query = new GetProductByIdQuery(new PrismaProductQueryService());
  });

  afterEach(async () => {
    if (testProductIds.length > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: testProductIds } },
      });
    }
  });

  it("IDで商品を取得できる", async () => {
    const { productId } = await createTestProduct({
      code: TEST_CODES[0],
      name: "ID取得テスト商品",
      costPrice: 1000,
    });

    const result = await query.execute({ id: productId });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(productId);
    expect(result?.code).toBe(TEST_CODES[0]);
    expect(result?.name).toBe("ID取得テスト商品");
    expect(result?.category).toBe(ProductCategory.INDIVIDUAL);
    expect(result?.costPrice).toBe(1000);
    expect(result?.relatedProducts).toEqual([]);
    expect(result?.setComponents).toEqual([]);
  });

  it("存在しないIDの場合は null を返す", async () => {
    const result = await query.execute({ id: "00000000-0000-7000-8000-000000000000" });

    expect(result).toBeNull();
  });
});
