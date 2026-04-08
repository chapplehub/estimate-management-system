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
import { SetProductRelationsCommand } from "../SetProductRelationsCommand";

describe("SetProductRelationsCommand", () => {
  let command: SetProductRelationsCommand;
  let repository: PrismaProductRepository;

  const TEST_CODES = ["SRPD001", "SRPD002", "SRPD003", "SRPD004"];

  async function cleanup() {
    await prisma.product.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaProductRepository();
    command = new SetProductRelationsCommand(repository);
  });

  afterEach(cleanup);

  it("個別商品に周辺商品を設定できる", async () => {
    const individual = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("SR個別商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.save(individual);

    const consumable = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("SR消耗品"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const savedConsumable = await repository.save(consumable);

    await command.execute({
      productId: saved.id.value,
      relations: [{ relatedProductId: savedConsumable.id.value, quantity: 3 }],
    });

    const updated = await repository.findById(saved.id);
    expect(updated!.relatedProducts).toHaveLength(1);
    expect(updated!.relatedProducts[0].relatedProductId.equals(savedConsumable.id)).toBe(true);
    expect(updated!.relatedProducts[0].quantity.value).toBe(3);
  });

  it("空配列で周辺商品をクリアできる", async () => {
    const individual = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("SRクリアテスト商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.save(individual);

    const consumable = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("SRクリア対象消耗品"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const savedConsumable = await repository.save(consumable);

    // 先に設定
    await command.execute({
      productId: saved.id.value,
      relations: [{ relatedProductId: savedConsumable.id.value, quantity: 1 }],
    });

    // 空配列でクリア
    await command.execute({
      productId: saved.id.value,
      relations: [],
    });

    const updated = await repository.findById(saved.id);
    expect(updated!.relatedProducts).toHaveLength(0);
  });

  it("存在しない商品IDにはエラー", async () => {
    const individual = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("SR存在しないテスト"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.save(individual);

    await expect(
      command.execute({
        productId: saved.id.value,
        relations: [{ relatedProductId: "00000000-0000-7000-8000-000000000000", quantity: 1 }],
      })
    ).rejects.toThrow(NotFoundEntityError);
  });

  it("B003: 消耗品には周辺商品を設定できない", async () => {
    const consumable = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("SR消耗品テスト"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const saved = await repository.save(consumable);

    const another = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("SR他の商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const savedAnother = await repository.save(another);

    await expect(
      command.execute({
        productId: saved.id.value,
        relations: [{ relatedProductId: savedAnother.id.value, quantity: 1 }],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        productId: saved.id.value,
        relations: [{ relatedProductId: savedAnother.id.value, quantity: 1 }],
      })
    ).rejects.toThrow("個別商品のみ周辺商品を設定できます");
  });

  it("B004: SET商品を周辺商品に設定するとエラー", async () => {
    const individual = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("SR個別商品B004"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.save(individual);

    const setProduct = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("SRセット商品B004"),
      ProductCategory.SET,
      ProductUnit.SET
    );
    const savedSet = await repository.save(setProduct);

    await expect(
      command.execute({
        productId: saved.id.value,
        relations: [{ relatedProductId: savedSet.id.value, quantity: 1 }],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        productId: saved.id.value,
        relations: [{ relatedProductId: savedSet.id.value, quantity: 1 }],
      })
    ).rejects.toThrow("セット商品は周辺商品として設定できません");
  });

  it("B005: 自分自身を周辺商品に設定するとエラー", async () => {
    const individual = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("SR自己参照テスト"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.save(individual);

    await expect(
      command.execute({
        productId: saved.id.value,
        relations: [{ relatedProductId: saved.id.value, quantity: 1 }],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        productId: saved.id.value,
        relations: [{ relatedProductId: saved.id.value, quantity: 1 }],
      })
    ).rejects.toThrow("自分自身を周辺商品に設定することはできません");
  });
});
