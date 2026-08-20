import prisma from "@server/prisma";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
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
    const saved = await repository.insert(product);

    await command.execute({ id: saved.id.value, expectedVersion: 1 });

    const deleted = await repository.findById(saved.id);
    expect(deleted).toBeNull();
  });

  // TODO: Estimateモデル実装時にテストを有効化する
  it.todo("B008: 見積・受注で使用中の商品は削除できない");

  it("存在しない商品を削除しようとするとエラー", async () => {
    await expect(
      command.execute({ id: "00000000-0000-7000-8000-000000000000", expectedVersion: 1 })
    ).rejects.toThrow(NotFoundEntityError);
    await expect(
      command.execute({ id: "00000000-0000-7000-8000-000000000000", expectedVersion: 1 })
    ).rejects.toThrow("商品が見つかりません");
  });

  it("stale な expectedVersion での削除は ConflictError（expectedVersion 素通しの検証）", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODE),
      new ProductName("競合テスト商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.insert(product);

    // 別ユーザーが更新して version を 1 → 2 へ進める
    saved.changeName(new ProductName("更新後"));
    await repository.update(saved, 1);

    // stale な version 1 のまま削除 → 競合として弾かれる（素通しが効いている証左）
    await expect(command.execute({ id: saved.id.value, expectedVersion: 1 })).rejects.toThrow(
      ConflictError
    );

    // 行は残存している（誤削除が防止された）
    const stillThere = await repository.findById(saved.id);
    expect(stillThere).not.toBeNull();
  });
});
