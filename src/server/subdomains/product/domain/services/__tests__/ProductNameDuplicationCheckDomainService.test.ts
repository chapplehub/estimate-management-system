import prisma from "@server/prisma";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Product } from "../../entities/Product";
import { ProductCategory } from "../../values/ProductCategory";
import { ProductCode } from "../../values/ProductCode";
import { ProductName } from "../../values/ProductName";
import { ProductUnit } from "../../values/ProductUnit";
import { ProductNameDuplicationCheckDomainService } from "../ProductNameDuplicationCheckDomainService";

describe("ProductNameDuplicationCheckDomainService", () => {
  let service: ProductNameDuplicationCheckDomainService;
  let repository: PrismaProductRepository;

  const TEST_CODE = "DUPNM999";
  const TEST_NAME = "重複テスト用商品NAME";

  async function cleanup() {
    await prisma.product.deleteMany({
      where: { code: TEST_CODE },
    });
  }

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaProductRepository();
    service = new ProductNameDuplicationCheckDomainService(repository);
  });

  afterEach(cleanup);

  it("商品名が存在しない場合は false を返す", async () => {
    const result = await service.execute(new ProductName(TEST_NAME));
    expect(result).toBe(false);
  });

  it("商品名が既に存在する場合は true を返す", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODE),
      new ProductName(TEST_NAME),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    await repository.insert(product);

    const result = await service.execute(new ProductName(TEST_NAME));
    expect(result).toBe(true);
  });

  it("excludeIdで自分自身を除外できる", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODE),
      new ProductName(TEST_NAME),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.insert(product);

    const result = await service.execute(new ProductName(TEST_NAME), saved.id);
    expect(result).toBe(false);
  });
});
