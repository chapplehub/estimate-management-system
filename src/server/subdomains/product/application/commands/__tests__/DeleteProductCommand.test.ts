import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductDeletionCheckDomainService } from "@subdomains/product/domain/services/ProductDeletionCheckDomainService";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeleteProductCommand } from "../DeleteProductCommand";

describe("DeleteProductCommand", () => {
  let command: DeleteProductCommand;
  let repository: PrismaProductRepository;

  const TEST_CODE = "DELPD998";

  async function cleanup() {
    await prisma.product.deleteMany({
      where: { code: TEST_CODE },
    });
  }

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaProductRepository();
    command = new DeleteProductCommand(
      repository,
      new ProductDeletionCheckDomainService(repository)
    );
  });

  afterEach(cleanup);

  it("商品を削除できる", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODE),
      new ProductName("削除テスト商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.save(product);

    await command.execute({ id: saved.id.value });

    const deleted = await repository.findById(saved.id);
    expect(deleted).toBeNull();
  });

  it("存在しない商品を削除しようとするとエラー", async () => {
    await expect(command.execute({ id: "00000000-0000-7000-8000-000000000000" })).rejects.toThrow(
      NotFoundEntityError
    );
    await expect(command.execute({ id: "00000000-0000-7000-8000-000000000000" })).rejects.toThrow(
      "商品が見つかりません"
    );
  });
});
