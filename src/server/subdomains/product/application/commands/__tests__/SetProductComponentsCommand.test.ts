import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SetProductComponentsCommand } from "../SetProductComponentsCommand";

describe("SetProductComponentsCommand", () => {
  let command: SetProductComponentsCommand;
  let repository: PrismaProductRepository;

  const TEST_CODES = ["SCPD001", "SCPD002", "SCPD003"];

  async function cleanup() {
    await prisma.product.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaProductRepository();
    command = new SetProductComponentsCommand(repository);
  });

  afterEach(cleanup);

  it("SET商品に構成商品を設定できる", async () => {
    const setProduct = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("セット商品"),
      ProductCategory.SET,
      ProductUnit.SET
    );
    const savedSet = await repository.save(setProduct);

    const individual = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("構成商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const savedIndividual = await repository.save(individual);

    await command.execute({
      productId: savedSet.id.value,
      components: [{ componentProductId: savedIndividual.id.value, quantity: 5 }],
    });

    const updated = await repository.findById(savedSet.id);
    expect(updated!.components).toHaveLength(1);
    expect(updated!.components[0].componentProductId.equals(savedIndividual.id)).toBe(true);
    expect(updated!.components[0].quantity.value).toBe(5);
  });

  it("空配列で構成商品をクリアできる", async () => {
    const setProduct = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("クリアテストセット"),
      ProductCategory.SET,
      ProductUnit.SET
    );
    const savedSet = await repository.save(setProduct);

    const individual = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("クリア対象構成品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const savedIndividual = await repository.save(individual);

    // 先に設定
    await command.execute({
      productId: savedSet.id.value,
      components: [{ componentProductId: savedIndividual.id.value, quantity: 1 }],
    });

    // 空配列でクリア
    await command.execute({
      productId: savedSet.id.value,
      components: [],
    });

    const updated = await repository.findById(savedSet.id);
    expect(updated!.components).toHaveLength(0);
  });

  it("存在しない構成商品IDにはエラー", async () => {
    const setProduct = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("存在しないテストセット"),
      ProductCategory.SET,
      ProductUnit.SET
    );
    const savedSet = await repository.save(setProduct);

    await expect(
      command.execute({
        productId: savedSet.id.value,
        components: [{ componentProductId: "00000000-0000-7000-8000-000000000000", quantity: 1 }],
      })
    ).rejects.toThrow(NotFoundEntityError);
  });

  it("B006: 個別商品には構成商品を設定できない", async () => {
    const individual = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("SC個別商品テスト"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.save(individual);

    const another = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("SC他の商品"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const savedAnother = await repository.save(another);

    await expect(
      command.execute({
        productId: saved.id.value,
        components: [{ componentProductId: savedAnother.id.value, quantity: 1 }],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        productId: saved.id.value,
        components: [{ componentProductId: savedAnother.id.value, quantity: 1 }],
      })
    ).rejects.toThrow("セット商品のみ構成商品を設定できます");
  });

  it("B007: SET商品を構成商品に設定するとエラー", async () => {
    const setProduct = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("セット商品B007"),
      ProductCategory.SET,
      ProductUnit.SET
    );
    const savedSet = await repository.save(setProduct);

    const anotherSet = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("構成に入れたいセット"),
      ProductCategory.SET,
      ProductUnit.SET
    );
    const savedAnotherSet = await repository.save(anotherSet);

    await expect(
      command.execute({
        productId: savedSet.id.value,
        components: [{ componentProductId: savedAnotherSet.id.value, quantity: 1 }],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        productId: savedSet.id.value,
        components: [{ componentProductId: savedAnotherSet.id.value, quantity: 1 }],
      })
    ).rejects.toThrow("セット商品を構成商品として設定することはできません");
  });
});
