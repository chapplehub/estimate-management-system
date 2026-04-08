import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductId } from "@subdomains/product/domain/values/ProductId";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ActivateProductCommand } from "../ActivateProductCommand";

describe("ActivateProductCommand", () => {
  let command: ActivateProductCommand;
  let repository: PrismaProductRepository;

  const TEST_CODE = "ACTPD998";

  async function cleanup() {
    await prisma.product.deleteMany({
      where: { code: TEST_CODE },
    });
  }

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaProductRepository();
    command = new ActivateProductCommand(repository);
  });

  afterEach(cleanup);

  it("無効な商品を有効化できる", async () => {
    const product = Product.reconstruct(
      ProductId.generate(),
      new ProductCode(TEST_CODE),
      new ProductName("有効化テスト商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT,
      false,
      null,
      null,
      null,
      [],
      [],
      new Date(),
      new Date()
    );
    const saved = await repository.save(product);

    await command.execute({ id: saved.id.value });

    const updated = await repository.findById(saved.id);
    expect(updated!.isActive).toBe(true);
  });

  it("存在しない商品を有効化しようとするとエラー", async () => {
    await expect(command.execute({ id: "00000000-0000-7000-8000-000000000000" })).rejects.toThrow(
      NotFoundEntityError
    );
    await expect(command.execute({ id: "00000000-0000-7000-8000-000000000000" })).rejects.toThrow(
      "商品が見つかりません"
    );
  });

  it("B009: すでに有効な商品を有効化するとエラー", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODE),
      new ProductName("すでに有効な商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.save(product);

    await expect(command.execute({ id: saved.id.value })).rejects.toThrow(
      BusinessRuleViolationError
    );
    await expect(command.execute({ id: saved.id.value })).rejects.toThrow("すでに有効な商品です");
  });
});
