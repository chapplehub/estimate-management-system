import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { MarginRate } from "@subdomains/customer/domain/values/MarginRate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaCustomerRepository } from "../PrismaCustomerRepository";

// 実データ・他テストと衝突しない予約コード帯（CMLK96x = customer 楽観ロックテスト）。
const TEST_CODES = ["CMLK960", "CMLK961", "CMLK962"] as const;

function buildCustomer(code: string, name = "テスト得意先"): Customer {
  return Customer.create(new CompanyCode(code), new CompanyName(name), {
    marginRate: new MarginRate(10),
  });
}

async function cleanup(): Promise<void> {
  await prisma.customer.deleteMany({ where: { code: { in: [...TEST_CODES] } } });
}

describe("PrismaCustomerRepository", () => {
  let repository: PrismaCustomerRepository;

  beforeEach(async () => {
    repository = new PrismaCustomerRepository();
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("insert → findById ラウンドトリップ", () => {
    it("新規得意先を等価に再構築でき、version は 1 で始まる", async () => {
      const saved = await repository.insert(buildCustomer(TEST_CODES[0], "営業商事"));

      const found = await repository.findById(saved.id);

      expect(found).not.toBeNull();
      if (!found) return;
      expect(found.id.value).toBe(saved.id.value);
      expect(found.code.value).toBe(TEST_CODES[0]);
      expect(found.name.value).toBe("営業商事");
      expect(found.isActive).toBe(true);

      // version 列は @default(1)。DB 行を直接確認する
      const row = await prisma.customer.findUnique({ where: { id: saved.id.value } });
      expect(row?.version).toBe(1);
    });
  });

  describe("楽観ロック（ADR-0039）", () => {
    it("insert した得意先（version 1）を expectedVersion=1 で更新でき、更新後は 2 で更新できる", async () => {
      const saved = await repository.insert(buildCustomer(TEST_CODES[0]));

      saved.changeName(new CompanyName("第1版"));
      const first = await repository.update(saved, 1);
      expect(first.id.value).toBe(saved.id.value);
      expect(first.name.value).toBe("第1版");

      // version は 2 へ進んでいる。一致トークンを提示すれば続けて更新できる
      const rowAfterFirst = await prisma.customer.findUnique({ where: { id: saved.id.value } });
      expect(rowAfterFirst?.version).toBe(2);

      first.changeName(new CompanyName("第2版"));
      await expect(repository.update(first, 2)).resolves.toBeDefined();
    });

    it("古い expectedVersion での更新は ConflictError になり、先行の変更は失われない", async () => {
      const saved = await repository.insert(buildCustomer(TEST_CODES[0], "営業商事"));

      // 2人のユーザーが同じ version 1 の編集画面を開いた状況を再現
      const loadedByB = await repository.findById(saved.id);
      const loadedByA = await repository.findById(saved.id);
      expect(loadedByB).not.toBeNull();
      expect(loadedByA).not.toBeNull();
      if (!loadedByB || !loadedByA) return;

      // B が先に保存（version 1 → 2）
      loadedByB.changeName(new CompanyName("Bの変更"));
      await repository.update(loadedByB, 1);

      // A が古いトークン 1 のまま保存 → 競合として弾かれる
      loadedByA.changeName(new CompanyName("Aの変更"));
      await expect(repository.update(loadedByA, 1)).rejects.toThrow(ConflictError);

      // B の変更が残っている（後勝ちによる lost update が起きていない）
      const found = await repository.findById(saved.id);
      expect(found?.name.value).toBe("Bの変更");
    });

    it("存在しない（削除済み）行への更新も count=0 として ConflictError になる", async () => {
      const saved = await repository.insert(buildCustomer(TEST_CODES[0]));
      const loaded = await repository.findById(saved.id);
      expect(loaded).not.toBeNull();
      if (!loaded) return;

      // 画面表示後に行が物理削除された状況
      await repository.delete(saved.id);

      loaded.changeName(new CompanyName("消えた行への更新"));
      await expect(repository.update(loaded, 1)).rejects.toThrow(ConflictError);
    });
  });
});
