import prisma from "@server/prisma";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Product } from "../../entities/Product";
import { ProductCategory } from "../../values/ProductCategory";
import { ProductCode } from "../../values/ProductCode";
import { ProductName } from "../../values/ProductName";
import { ProductUnit } from "../../values/ProductUnit";
import { ProductCodeDuplicationCheckDomainService } from "../ProductCodeDuplicationCheckDomainService";

describe("ProductCodeDuplicationCheckDomainService", () => {
  let service: ProductCodeDuplicationCheckDomainService;
  let repository: PrismaProductRepository;

  const TEST_CODE = "DUPCD999";
  const TEST_NAME = "重複テスト用商品CODE";

  async function cleanup() {
    await prisma.product.deleteMany({
      where: { code: TEST_CODE },
    });
  }

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaProductRepository();
    service = new ProductCodeDuplicationCheckDomainService(repository);
  });

  afterEach(cleanup);

  it("商品コードが存在しない場合は false を返す", async () => {
    const result = await service.execute(new ProductCode(TEST_CODE));
    expect(result).toBe(false);
  });

  it("商品コードが既に存在する場合は true を返す", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODE),
      new ProductName(TEST_NAME),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    await repository.insert(product);

    const result = await service.execute(new ProductCode(TEST_CODE));
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

    const result = await service.execute(new ProductCode(TEST_CODE), saved.id);
    expect(result).toBe(false);
  });
});
