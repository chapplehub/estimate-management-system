import prisma from "@server/prisma";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { ProductCodeDuplicationCheckDomainService } from "@subdomains/product/domain/services/ProductCodeDuplicationCheckDomainService";
import { ProductNameDuplicationCheckDomainService } from "@subdomains/product/domain/services/ProductNameDuplicationCheckDomainService";
import { Product } from "@subdomains/product/domain/entities/Product";
import { ProductCategory } from "@subdomains/product/domain/values/ProductCategory";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { ProductName } from "@subdomains/product/domain/values/ProductName";
import { ProductUnit } from "@subdomains/product/domain/values/ProductUnit";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateProductCommand } from "../UpdateProductCommand";

describe("UpdateProductCommand", () => {
  let command: UpdateProductCommand;
  let repository: PrismaProductRepository;

  const TEST_CODES = ["UPDPD998", "UPDPD999"];

  async function cleanup() {
    await prisma.product.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaProductRepository();
    command = new UpdateProductCommand(
      repository,
      new ProductCodeDuplicationCheckDomainService(repository),
      new ProductNameDuplicationCheckDomainService(repository)
    );
  });

  afterEach(cleanup);

  it("商品情報を更新できる", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("更新前商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.insert(product);

    await command.execute({
      id: saved.id.value,
      expectedVersion: 1,
      category: "INDIVIDUAL",
      code: TEST_CODES[1],
      name: "更新後商品",
      unit: "BOX",
      description: "新しい説明",
      note: "新しい備考",
    });

    const updated = await repository.findById(saved.id);
    expect(updated!.code.value).toBe(TEST_CODES[1]);
    expect(updated!.name.value).toBe("更新後商品");
    expect(updated!.unit.value).toBe("BOX");
    expect(updated!.description?.value).toBe("新しい説明");
    expect(updated!.note?.value).toBe("新しい備考");
  });

  it("説明と備考をnullでクリアできる", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("クリアテスト商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.insert(product);

    // まず説明と備考を設定
    await command.execute({
      id: saved.id.value,
      expectedVersion: 1,
      category: "INDIVIDUAL",
      description: "一時的な説明",
      note: "一時的な備考",
    });

    // nullで説明と備考をクリア（先行更新で version は 2 に進んでいる）
    await command.execute({
      id: saved.id.value,
      expectedVersion: 2,
      category: "INDIVIDUAL",
      description: null,
      note: null,
    });

    const updated = await repository.findById(saved.id);
    expect(updated!.description).toBeNull();
    expect(updated!.note).toBeNull();
  });

  it("存在しない商品を更新しようとするとエラー", async () => {
    await expect(
      command.execute({
        id: "00000000-0000-7000-8000-000000000000",
        expectedVersion: 1,
        category: "INDIVIDUAL",
        name: "存在しない商品",
      })
    ).rejects.toThrow(NotFoundEntityError);
    await expect(
      command.execute({
        id: "00000000-0000-7000-8000-000000000000",
        expectedVersion: 1,
        category: "INDIVIDUAL",
        name: "存在しない商品",
      })
    ).rejects.toThrow("商品が見つかりません");
  });

  it("B011: 商品区分を変更しようとするとエラー", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("区分変更テスト商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.insert(product);

    await expect(
      command.execute({
        id: saved.id.value,
        expectedVersion: 1,
        category: "SET",
        name: "変更後",
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        id: saved.id.value,
        expectedVersion: 1,
        category: "SET",
        name: "変更後",
      })
    ).rejects.toThrow("商品区分は変更できません");
  });

  it("古い expectedVersion での更新は ConflictError になり、先行の変更は失われない（楽観ロック / ADR-0039）", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("UPD競合テスト商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.insert(product);

    // 先行更新が version 1 → 2 に進める
    await command.execute({
      id: saved.id.value,
      expectedVersion: 1,
      category: "INDIVIDUAL",
      name: "先行の変更",
    });

    // 古い画面（version 1）からの保存は競合として弾かれる
    await expect(
      command.execute({
        id: saved.id.value,
        expectedVersion: 1,
        category: "INDIVIDUAL",
        name: "後発の変更",
      })
    ).rejects.toThrow(ConflictError);

    // 先行の変更が残っている
    const found = await repository.findById(saved.id);
    expect(found?.name.value).toBe("先行の変更");
  });

  it("コード重複チェックで自身は除外される", async () => {
    const product = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("自身除外テスト商品"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const saved = await repository.insert(product);

    // 同じコードで更新（自身なのでOK）
    await expect(
      command.execute({
        id: saved.id.value,
        expectedVersion: 1,
        category: "INDIVIDUAL",
        code: TEST_CODES[0],
        name: "名前だけ変更",
      })
    ).resolves.not.toThrow();
  });

  it("他の商品と同じコードに変更するとエラー", async () => {
    const product1 = Product.create(
      new ProductCode(TEST_CODES[0]),
      new ProductName("商品1"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    const product2 = Product.create(
      new ProductCode(TEST_CODES[1]),
      new ProductName("商品2"),
      ProductCategory.INDIVIDUAL,
      ProductUnit.UNIT
    );
    await repository.insert(product1);
    const saved2 = await repository.insert(product2);

    await expect(
      command.execute({
        id: saved2.id.value,
        expectedVersion: 1,
        category: "INDIVIDUAL",
        code: TEST_CODES[0],
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        id: saved2.id.value,
        expectedVersion: 1,
        category: "INDIVIDUAL",
        code: TEST_CODES[0],
      })
    ).rejects.toThrow("既に存在する商品コードです");
  });
});
