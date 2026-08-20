import prisma from "@server/prisma";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductReplacementDomainService } from "@subdomains/product/domain/services/ProductReplacementDomainService";
import { ComponentQuantity } from "@subdomains/product/domain/values/ComponentQuantity";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductRelation } from "@subdomains/product/domain/values/ProductRelation";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeactivateProductWithReplacementCommand } from "../DeactivateProductWithReplacementCommand";

describe("DeactivateProductWithReplacementCommand", () => {
  let command: DeactivateProductWithReplacementCommand;
  let repository: PrismaProductRepository;

  const TEST_CODES = ["DRPD001", "DRPD002", "DRPD003", "DRPD004"];

  async function cleanup() {
    // relations/componentsはonDelete:Cascadeで自動削除される
    await prisma.product.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaProductRepository();
    command = new DeactivateProductWithReplacementCommand(
      repository,
      new ProductReplacementDomainService()
    );
  });

  afterEach(cleanup);

  it("商品を無効化して入れ替えできる", async () => {
    // target: 無効化対象の消耗品
    const target = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("無効化対象商品"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const savedTarget = await repository.insert(target);

    // replacement: 入れ替え先の消耗品
    const replacement = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("入れ替え先商品"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    await repository.insert(replacement);

    // referencing: targetを周辺商品に持つ個別商品
    const referencing = Product.create(
      new ProductCode(TEST_CODES[2]),
      new ProductName("参照元商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const savedReferencing = await repository.insert(referencing);

    // 参照元にtargetを周辺商品として設定
    const updatedReferencing = (await repository.findById(savedReferencing.id))!;
    updatedReferencing.setRelatedProducts([
      ProductRelation.create(savedTarget.id, ProductCategory.CONSUMABLE, new ComponentQuantity(3)),
    ]);
    await repository.update(updatedReferencing, 1);

    // 入れ替え実行
    await command.execute({
      id: savedTarget.id.value,
      expectedVersion: 1,
      replacementCode: TEST_CODES[1],
    });

    // target は無効化されている
    const deactivated = await repository.findById(savedTarget.id);
    expect(deactivated!.isActive).toBe(false);

    // 参照元の周辺商品がreplacementに入れ替わっている
    const updatedRef = await repository.findById(savedReferencing.id);
    expect(updatedRef!.relatedProducts).toHaveLength(1);
    expect(updatedRef!.relatedProducts[0].relatedProductId.equals(replacement.id)).toBe(true);
    expect(updatedRef!.relatedProducts[0].quantity.value).toBe(3);
  });

  it("古い expectedVersion での入れ替えつき無効化は ConflictError になり、無効化も入れ替えも起きない（楽観ロック / ADR-0039）", async () => {
    const target = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("競合テスト対象商品"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const savedTarget = await repository.insert(target);

    const replacement = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("競合テスト入れ替え先"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    await repository.insert(replacement);

    // referencing: target を周辺商品に持つ個別商品
    const referencing = Product.create(
      new ProductCode(TEST_CODES[2]),
      new ProductName("競合テスト参照元"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const savedReferencing = await repository.insert(referencing);
    const loadedReferencing = (await repository.findById(savedReferencing.id))!;
    loadedReferencing.setRelatedProducts([
      ProductRelation.create(savedTarget.id, ProductCategory.CONSUMABLE, new ComponentQuantity(3)),
    ]);
    await repository.update(loadedReferencing, 1);

    // 別ユーザーの更新が target の version を 1 → 2 に進める
    const loadedTarget = (await repository.findById(savedTarget.id))!;
    loadedTarget.changeName(new ProductName("DR別ユーザーの変更"));
    await repository.update(loadedTarget, 1);

    // 古い画面（version 1）からの実行は、何も変更される前に競合として弾かれる
    await expect(
      command.execute({
        id: savedTarget.id.value,
        expectedVersion: 1,
        replacementCode: TEST_CODES[1],
      })
    ).rejects.toThrow(ConflictError);

    // target は無効化されていない
    const foundTarget = await repository.findById(savedTarget.id);
    expect(foundTarget?.isActive).toBe(true);

    // 参照元の周辺商品も入れ替わっていない（target を指したまま）
    const foundReferencing = await repository.findById(savedReferencing.id);
    expect(foundReferencing?.relatedProducts).toHaveLength(1);
    expect(foundReferencing?.relatedProducts[0].relatedProductId.equals(savedTarget.id)).toBe(true);
  });

  it("存在しない商品を無効化しようとするとエラー", async () => {
    await expect(
      command.execute({
        id: "00000000-0000-7000-8000-000000000000",
        expectedVersion: 1,
        replacementCode: TEST_CODES[0],
      })
    ).rejects.toThrow(NotFoundEntityError);
  });

  it("存在しない入れ替え先商品コードはエラー", async () => {
    const target = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("対象商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.insert(target);

    await expect(
      command.execute({
        id: saved.id.value,
        expectedVersion: 1,
        replacementCode: "NONEXIST",
      })
    ).rejects.toThrow(NotFoundEntityError);
    await expect(
      command.execute({
        id: saved.id.value,
        expectedVersion: 1,
        replacementCode: "NONEXIST",
      })
    ).rejects.toThrow("商品が見つかりません");
  });

  it("B013: 無効な商品への入れ替えはエラー", async () => {
    const target = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("対象商品B013"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const savedTarget = await repository.insert(target);

    // 無効な入れ替え先を作成
    const replacement = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("無効入れ替え先"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const savedReplacement = await repository.insert(replacement);
    // 無効化する
    const repl = (await repository.findById(savedReplacement.id))!;
    repl.deactivate();
    await repository.update(repl, 1);

    await expect(
      command.execute({
        id: savedTarget.id.value,
        expectedVersion: 1,
        replacementCode: TEST_CODES[1],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        id: savedTarget.id.value,
        expectedVersion: 1,
        replacementCode: TEST_CODES[1],
      })
    ).rejects.toThrow("入れ替え先の商品が無効です");
  });

  it("B014: セット商品への入れ替えはエラー", async () => {
    const target = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("対象商品B014"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const savedTarget = await repository.insert(target);

    const replacement = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("セット入れ替え先"),
      ProductCategory.SET,
      ProductUnit.SET
    );
    await repository.insert(replacement);

    await expect(
      command.execute({
        id: savedTarget.id.value,
        expectedVersion: 1,
        replacementCode: TEST_CODES[1],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        id: savedTarget.id.value,
        expectedVersion: 1,
        replacementCode: TEST_CODES[1],
      })
    ).rejects.toThrow("セット商品は入れ替え先として指定できません");
  });

  it("B015: 入れ替え先が参照元で重複する場合はエラー", async () => {
    // target: 無効化対象
    const target = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("対象商品B015"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const savedTarget = await repository.insert(target);

    // replacement: 入れ替え先
    const replacement = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("入れ替え先B015"),
      ProductCategory.CONSUMABLE,
      ProductUnit.PIECE
    );
    const savedReplacement = await repository.insert(replacement);

    // referencing: targetとreplacementの両方を周辺商品に持つ（重複発生）
    const referencing = Product.create(
      new ProductCode(TEST_CODES[2]),
      new ProductName("重複参照元商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const savedReferencing = await repository.insert(referencing);

    const updatedReferencing = (await repository.findById(savedReferencing.id))!;
    updatedReferencing.setRelatedProducts([
      ProductRelation.create(savedTarget.id, ProductCategory.CONSUMABLE, new ComponentQuantity(1)),
      ProductRelation.create(
        savedReplacement.id,
        ProductCategory.CONSUMABLE,
        new ComponentQuantity(2)
      ),
    ]);
    await repository.update(updatedReferencing, 1);

    await expect(
      command.execute({
        id: savedTarget.id.value,
        expectedVersion: 1,
        replacementCode: TEST_CODES[1],
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        id: savedTarget.id.value,
        expectedVersion: 1,
        replacementCode: TEST_CODES[1],
      })
    ).rejects.toThrow("重複参照元商品");
  });
});
