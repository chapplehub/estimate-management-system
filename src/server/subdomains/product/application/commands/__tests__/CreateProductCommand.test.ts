import prisma from "@server/prisma";
import { ValidationError } from "@server/shared/errors/DomainError";
import { ProductCodeDuplicationCheckDomainService } from "@subdomains/product/domain/services/ProductCodeDuplicationCheckDomainService";
import { ProductNameDuplicationCheckDomainService } from "@subdomains/product/domain/services/ProductNameDuplicationCheckDomainService";
import { ProductCode } from "@subdomains/product/domain/values/ProductCode";
import { PrismaProductRepository } from "@subdomains/product/infrastructure/prisma/PrismaProductRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreateProductCommand } from "../CreateProductCommand";

describe("CreateProductCommand", () => {
  let command: CreateProductCommand;
  let repository: PrismaProductRepository;

  const TEST_CODES = ["CRTPD998", "CRTPD999"];

  async function cleanup() {
    await prisma.product.deleteMany({
      where: { code: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();
    repository = new PrismaProductRepository();
    command = new CreateProductCommand(
      repository,
      new ProductCodeDuplicationCheckDomainService(repository),
      new ProductNameDuplicationCheckDomainService(repository)
    );
  });

  afterEach(cleanup);

  it("必須項目のみで商品を作成できる", async () => {
    await command.execute({
      code: TEST_CODES[0],
      name: "テスト商品作成",
      category: "INDIVIDUAL",
      unit: "UNIT",
    });

    const saved = await repository.findByCode(new ProductCode(TEST_CODES[0]));
    expect(saved).not.toBeNull();
    expect(saved!.code.value).toBe(TEST_CODES[0]);
    expect(saved!.name.value).toBe("テスト商品作成");
    expect(saved!.category.value).toBe("INDIVIDUAL");
    expect(saved!.unit.value).toBe("UNIT");
    expect(saved!.isActive).toBe(true);
    expect(saved!.description).toBeNull();
    expect(saved!.note).toBeNull();
  });

  it("全項目指定で商品を作成できる", async () => {
    await command.execute({
      code: TEST_CODES[0],
      name: "テスト商品全項目",
      category: "INDIVIDUAL",
      unit: "PIECE",
      description: "商品の説明",
      note: "備考メモ",
    });

    const saved = await repository.findByCode(new ProductCode(TEST_CODES[0]));
    expect(saved!.description?.value).toBe("商品の説明");
    expect(saved!.note?.value).toBe("備考メモ");
  });

  it("B001: 既に存在する商品コードの場合はエラー", async () => {
    await command.execute({
      code: TEST_CODES[0],
      name: "最初の商品",
      category: "INDIVIDUAL",
      unit: "UNIT",
    });

    await expect(
      command.execute({
        code: TEST_CODES[0],
        name: "重複コード商品",
        category: "INDIVIDUAL",
        unit: "UNIT",
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        code: TEST_CODES[0],
        name: "重複コード商品",
        category: "INDIVIDUAL",
        unit: "UNIT",
      })
    ).rejects.toThrow("既に存在する商品コードです");
  });

  it("B002: 既に存在する商品名の場合はエラー", async () => {
    await command.execute({
      code: TEST_CODES[0],
      name: "重複テスト商品名",
      category: "INDIVIDUAL",
      unit: "UNIT",
    });

    await expect(
      command.execute({
        code: TEST_CODES[1],
        name: "重複テスト商品名",
        category: "CONSUMABLE",
        unit: "PIECE",
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        code: TEST_CODES[1],
        name: "重複テスト商品名",
        category: "CONSUMABLE",
        unit: "PIECE",
      })
    ).rejects.toThrow("既に存在する商品名です");
  });
});
