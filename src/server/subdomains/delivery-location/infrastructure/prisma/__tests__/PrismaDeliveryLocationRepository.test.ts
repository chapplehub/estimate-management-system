import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { CompanyCode } from "@server/shared/domain/values/CompanyCode";
import { CompanyName } from "@server/shared/domain/values/CompanyName";
import { Customer } from "@subdomains/customer/domain/entities/Customer";
import { PrismaCustomerRepository } from "@subdomains/customer/infrastructure/prisma/PrismaCustomerRepository";
import { DeliveryLocation } from "@subdomains/delivery-location/domain/entities/DeliveryLocation";
import { CustomerId } from "@subdomains/customer/domain/values/CustomerId";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaDeliveryLocationRepository } from "../PrismaDeliveryLocationRepository";

// 実データ・他テストと衝突しない予約コード帯（DLLK97x = delivery-location 楽観ロックテスト）。
const TEST_CODES = ["DLLK970", "DLLK971", "DLLK972"] as const;
// 親得意先（FK: delivery_location.customer_id → customer.id）用の予約コード。
const PARENT_CUSTOMER_CODE = "CMLKDL97";

function buildDeliveryLocation(
  code: string,
  customerId: CustomerId,
  name = "テスト納品先"
): DeliveryLocation {
  return DeliveryLocation.create(new CompanyCode(code), new CompanyName(name), customerId);
}

async function cleanup(): Promise<void> {
  await prisma.deliveryLocation.deleteMany({ where: { code: { in: [...TEST_CODES] } } });
  await prisma.customer.deleteMany({ where: { code: PARENT_CUSTOMER_CODE } });
}

describe("PrismaDeliveryLocationRepository", () => {
  let repository: PrismaDeliveryLocationRepository;
  let parentCustomerId: CustomerId;

  beforeEach(async () => {
    repository = new PrismaDeliveryLocationRepository();
    await cleanup();

    // 納品先は得意先を親に持つ（独立集約だが FK 制約あり）。先に親を作る。
    const customerRepository = new PrismaCustomerRepository();
    const parent = await customerRepository.insert(
      Customer.create(new CompanyCode(PARENT_CUSTOMER_CODE), new CompanyName("親得意先"))
    );
    parentCustomerId = parent.id;
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("insert → findById ラウンドトリップ", () => {
    it("新規納品先を等価に再構築でき、version は 1 で始まる", async () => {
      const saved = await repository.insert(
        buildDeliveryLocation(TEST_CODES[0], parentCustomerId, "配送センター")
      );

      const found = await repository.findById(saved.id);

      expect(found).not.toBeNull();
      if (!found) return;
      expect(found.id.value).toBe(saved.id.value);
      expect(found.code.value).toBe(TEST_CODES[0]);
      expect(found.name.value).toBe("配送センター");
      expect(found.isActive).toBe(true);

      // version 列は @default(1)。DB 行を直接確認する
      const row = await prisma.deliveryLocation.findUnique({ where: { id: saved.id.value } });
      expect(row?.version).toBe(1);
    });
  });

  describe("楽観ロック（ADR-0039）", () => {
    it("insert した納品先（version 1）を expectedVersion=1 で更新でき、更新後は 2 で更新できる", async () => {
      const saved = await repository.insert(buildDeliveryLocation(TEST_CODES[0], parentCustomerId));

      saved.changeName(new CompanyName("第1版"));
      const first = await repository.update(saved, 1);
      expect(first.id.value).toBe(saved.id.value);
      expect(first.name.value).toBe("第1版");

      // version は 2 へ進んでいる。一致トークンを提示すれば続けて更新できる
      const rowAfterFirst = await prisma.deliveryLocation.findUnique({
        where: { id: saved.id.value },
      });
      expect(rowAfterFirst?.version).toBe(2);

      first.changeName(new CompanyName("第2版"));
      await expect(repository.update(first, 2)).resolves.toBeDefined();
    });

    it("古い expectedVersion での更新は ConflictError になり、先行の変更は失われない", async () => {
      const saved = await repository.insert(
        buildDeliveryLocation(TEST_CODES[0], parentCustomerId, "配送センター")
      );

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
      const saved = await repository.insert(buildDeliveryLocation(TEST_CODES[0], parentCustomerId));
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
