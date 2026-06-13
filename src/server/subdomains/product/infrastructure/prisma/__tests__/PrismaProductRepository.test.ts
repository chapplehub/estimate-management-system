import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaProductRepository } from "../PrismaProductRepository";

describe("PrismaProductRepository", () => {
  let repository: PrismaProductRepository;

  const TEST_CODES = ["PRREPO001", "PRREPO002", "PRREPO003"];

  async function cleanup() {
    await prisma.product.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaProductRepository();
  });

  afterEach(cleanup);

  describe("insert", () => {
    it("新規商品を保存でき、version は 1 で始まる", async () => {
      const product = Product.create(
        new ProductCode(TEST_CODES[0]),
        new ProductName("挿入テスト商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      );

      const saved = await repository.insert(product);

      expect(saved.code.value).toBe(TEST_CODES[0]);
      expect(saved.name.value).toBe("挿入テスト商品");

      const row = await prisma.product.findUnique({
        where: { code: TEST_CODES[0] },
      });
      expect(row).not.toBeNull();
      expect(row?.version).toBe(1);
    });
  });

  describe("update", () => {
    it("一致する expectedVersion で更新でき、version が 1 進む", async () => {
      const product = Product.create(
        new ProductCode(TEST_CODES[0]),
        new ProductName("更新前の商品"),
        ProductCategory.INDIVIDUAL,
        ProductUnit.UNIT
      );
      const saved = await repository.insert(product);

      saved.changeName(new ProductName("更新後の商品"));
      const updated = await repository.update(saved, 1);

      expect(updated.name.value).toBe("更新後の商品");

      const row = await prisma.product.findUnique({
        where: { code: TEST_CODES[0] },
      });
      expect(row?.name).toBe("更新後の商品");
      expect(row?.version).toBe(2);
    });
  });

  describe("楽観ロック（ADR-0039）", () => {
    it("古い expectedVersion での更新は ConflictError になり、先行の変更は失われない", async () => {
      const saved = await repository.insert(
        Product.create(
          new ProductCode(TEST_CODES[0]),
          new ProductName("競合テスト商品"),
          ProductCategory.INDIVIDUAL,
          ProductUnit.UNIT
        )
      );

      // 2人のユーザーが同じ version 1 の編集画面を開いた状況を再現
      const loadedByB = await repository.findById(saved.id);
      const loadedByA = await repository.findById(saved.id);
      expect(loadedByB).not.toBeNull();
      expect(loadedByA).not.toBeNull();
      if (!loadedByB || !loadedByA) return;

      // B が先に保存（version 1 → 2）
      loadedByB.changeName(new ProductName("Bの変更"));
      await repository.update(loadedByB, 1);

      // A が古いトークン 1 のまま保存 → 競合として弾かれる
      loadedByA.changeName(new ProductName("Aの変更"));
      await expect(repository.update(loadedByA, 1)).rejects.toThrow(ConflictError);
      await expect(repository.update(loadedByA, 1)).rejects.toThrow(
        "他のユーザーによって更新または削除されています。画面を再読み込みして最新の内容を確認してください。"
      );

      // B の変更が残っている（後勝ちによる lost update が起きていない）
      const found = await repository.findById(saved.id);
      expect(found?.name.value).toBe("Bの変更");
    });
  });
});
