import prisma from "@server/prisma";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { PrismaRoleRepository } from "../PrismaRoleRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * PrismaRoleRepository の統合テスト（実 DB）。
 *
 * 主眼は ADR-0039 の楽観ロックを「逐次の stale トークン再現」で実証すること。
 * 防御の実体は条件付き updateMany 1 文の原子性（PostgreSQL 保証）なので、
 * Promise.all による真の並行テストは flaky の割に証明力が増えないため採らない。
 */
describe("PrismaRoleRepository", () => {
  let repository: PrismaRoleRepository;

  // 他テストファイルとの並列実行衝突を避けるため未使用の roleCd を専有する
  const TEST_ROLE_CDS = ["ROLE901", "ROLE902", "ROLE903"];

  let kachouPositionId: string;

  async function cleanup() {
    await prisma.role.updateMany({
      where: { roleCd: { in: TEST_ROLE_CDS } },
      data: { superiorRoleId: null },
    });
    await prisma.role.deleteMany({
      where: { roleCd: { in: TEST_ROLE_CDS } },
    });
  }

  beforeEach(async () => {
    await cleanup();

    const kachou = await prisma.position.findUnique({ where: { positionCd: "POS001" } });
    kachouPositionId = kachou!.id;

    repository = new PrismaRoleRepository();
  });

  afterEach(cleanup);

  function buildRole(roleCd: string, name: string): Role {
    return Role.create(new RoleCd(roleCd), new RoleName(name), new PositionId(kachouPositionId));
  }

  describe("insert → findById ラウンドトリップ", () => {
    it("新規作成した役割を ID で取得できる", async () => {
      const role = buildRole(TEST_ROLE_CDS[0], "ラウンドトリップ役割");

      await repository.insert(role);
      const found = await repository.findById(role.id);

      expect(found).not.toBeNull();
      expect(found!.roleCd.value).toBe(TEST_ROLE_CDS[0]);
      expect(found!.name.value).toBe("ラウンドトリップ役割");
    });
  });

  describe("update（楽観ロック）", () => {
    it("insert した役割（version 1）を expectedVersion=1 で更新でき、更新後は 2 で更新できる", async () => {
      const role = buildRole(TEST_ROLE_CDS[0], "初期名");
      await repository.insert(role);

      // insert 直後の version は 1。一致するトークンでの更新は成功し、version は 2 に進む
      role.changeName(new RoleName("1回目更新"));
      const first = await repository.update(role, 1);
      expect(first.name.value).toBe("1回目更新");

      // 進んだ version 2 を提示すれば続けて更新できる
      first.changeName(new RoleName("2回目更新"));
      await expect(repository.update(first, 2)).resolves.toBeDefined();

      const finalRow = await prisma.role.findUnique({ where: { id: role.id.value } });
      expect(finalRow!.version).toBe(3);
      expect(finalRow!.name).toBe("2回目更新");
    });

    it("古い expectedVersion での更新は ConflictError になり、先行の変更は失われない", async () => {
      const role = buildRole(TEST_ROLE_CDS[0], "初期名");
      await repository.insert(role);

      // 2人のユーザーが同じ version 1 の画面を開いた状況を再現
      const loadedByA = await repository.findById(role.id);
      const loadedByB = await repository.findById(role.id);
      expect(loadedByA).not.toBeNull();
      expect(loadedByB).not.toBeNull();

      // B が先に保存（version 1 → 2）
      loadedByB!.changeName(new RoleName("Bの変更"));
      await repository.update(loadedByB!, 1);

      // A は古い version 1 を提示 → 競合として弾かれる
      loadedByA!.changeName(new RoleName("Aの変更"));
      await expect(repository.update(loadedByA!, 1)).rejects.toThrow(ConflictError);

      // B の先行変更が残存している（lost update が起きていない）
      const finalRow = await prisma.role.findUnique({ where: { id: role.id.value } });
      expect(finalRow!.name).toBe("Bの変更");
      expect(finalRow!.version).toBe(2);
    });

    it("存在しない（削除済み）役割の更新は ConflictError になる", async () => {
      const role = buildRole(TEST_ROLE_CDS[0], "消える役割");
      await repository.insert(role);
      await repository.delete(role.id, 1);

      role.changeName(new RoleName("更新試行"));
      await expect(repository.update(role, 1)).rejects.toThrow(ConflictError);
    });

    it("古い expectedVersion での削除は ConflictError になり、行は残存する", async () => {
      const role = buildRole(TEST_ROLE_CDS[0], "営業役割");
      await repository.insert(role);

      // 画面表示時の version 1 を A が握ったまま、B が更新して version を 2 へ進める
      role.changeName(new RoleName("Bの変更"));
      await repository.update(role, 1);

      // A が stale な version 1 のまま削除 → 競合として弾かれる
      await expect(repository.delete(role.id, 1)).rejects.toThrow(ConflictError);

      // 行は残存している（stale な判断による誤削除が防止された）
      const stillThere = await repository.findById(role.id);
      expect(stillThere).not.toBeNull();
    });

    it("一致する expectedVersion での削除は成功し、行は消える", async () => {
      const role = buildRole(TEST_ROLE_CDS[0], "消える役割2");
      await repository.insert(role);

      await repository.delete(role.id, 1);

      const found = await repository.findById(role.id);
      expect(found).toBeNull();
    });
  });
});
