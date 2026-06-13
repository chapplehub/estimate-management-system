import prisma from "@server/prisma";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
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
    const saved = await repository.insert(individual);

    const consumable = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("SR消耗品"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const savedConsumable = await repository.insert(consumable);

    await command.execute({
      productId: saved.id.value,
      expectedVersion: 1,
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
    const saved = await repository.insert(individual);

    const consumable = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("SRクリア対象消耗品"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const savedConsumable = await repository.insert(consumable);

    // 先に設定
    await command.execute({
      productId: saved.id.value,
      expectedVersion: 1,
      relations: [{ relatedProductId: savedConsumable.id.value, quantity: 1 }],
    });

    // 空配列でクリア（先行設定で version は 2 に進んでいる）
    await command.execute({
      productId: saved.id.value,
      expectedVersion: 2,
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
    const saved = await repository.insert(individual);

    await expect(
      command.execute({
        productId: saved.id.value,
        expectedVersion: 1,
        relations: [{ relatedProductId: "00000000-0000-7000-8000-000000000000", quantity: 1 }],
      })
    ).rejects.toThrow(NotFoundEntityError);
  });

  it("古い expectedVersion での周辺商品設定は ConflictError になる（楽観ロック / ADR-0039）", async () => {
    const individual = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("SR競合テスト商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.insert(individual);

    const consumable = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("SR競合テスト消耗品"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const savedConsumable = await repository.insert(consumable);

    // 別ユーザーの設定が version 1 → 2 に進める
    await command.execute({
      productId: saved.id.value,
      expectedVersion: 1,
      relations: [{ relatedProductId: savedConsumable.id.value, quantity: 2 }],
    });

    // 古い画面（version 1）からの設定は競合として弾かれ、先行の設定が残る
    await expect(
      command.execute({
        productId: saved.id.value,
        expectedVersion: 1,
        relations: [],
      })
    ).rejects.toThrow(ConflictError);

    const found = await repository.findById(saved.id);
    expect(found?.relatedProducts).toHaveLength(1);
    expect(found?.relatedProducts[0].quantity.value).toBe(2);
  });

  it("B003: 消耗品には周辺商品を設定できない", async () => {
    const consumable = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("SR消耗品テスト"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const saved = await repository.insert(consumable);

    const another = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("SR他の商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const savedAnother = await repository.insert(another);

    await expect(
      command.execute({
        productId: saved.id.value,
        expectedVersion: 1,
        relations: [{ relatedProductId: savedAnother.id.value, quantity: 1 }],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        productId: saved.id.value,
        expectedVersion: 1,
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
    const saved = await repository.insert(individual);

    const setProduct = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("SRセット商品B004"),
      ProductCategory.SET,
      ProductUnit.SET
    );
    const savedSet = await repository.insert(setProduct);

    await expect(
      command.execute({
        productId: saved.id.value,
        expectedVersion: 1,
        relations: [{ relatedProductId: savedSet.id.value, quantity: 1 }],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        productId: saved.id.value,
        expectedVersion: 1,
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
    const saved = await repository.insert(individual);

    await expect(
      command.execute({
        productId: saved.id.value,
        expectedVersion: 1,
        relations: [{ relatedProductId: saved.id.value, quantity: 1 }],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        productId: saved.id.value,
        expectedVersion: 1,
        relations: [{ relatedProductId: saved.id.value, quantity: 1 }],
      })
    ).rejects.toThrow("自分自身を周辺商品に設定することはできません");
  });
});
