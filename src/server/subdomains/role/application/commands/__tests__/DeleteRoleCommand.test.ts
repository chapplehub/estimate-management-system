import prisma from "@server/prisma";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeleteRoleCommand } from "../DeleteRoleCommand";

describe("DeleteRoleCommand", () => {
  let command: DeleteRoleCommand;
  let roleRepository: PrismaRoleRepository;

  const TEST_ROLE_CDS = ["ROLE961", "ROLE962"];

  let kachouPositionId: string;
  let buchouPositionId: string;

  async function cleanup() {
    // 下位役割のFK参照を解除してから削除
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

    const [kachou, buchou] = await Promise.all([
      prisma.position.findUnique({ where: { positionCd: "POS001" } }),
      prisma.position.findUnique({ where: { positionCd: "POS002" } }),
    ]);
    kachouPositionId = kachou!.id;
    buchouPositionId = buchou!.id;

    roleRepository = new PrismaRoleRepository();
    command = new DeleteRoleCommand(roleRepository);
  });

  afterEach(cleanup);

  it("役割を削除できる", async () => {
    const role = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("削除テスト役割"),
      new PositionId(kachouPositionId)
    );
    await roleRepository.insert(role);

    await command.execute({ id: role.id.value, expectedVersion: 1 });

    const deleted = await roleRepository.findById(role.id);
    expect(deleted).toBeNull();
  });

  it("存在しない役割を削除しようとするとエラー", async () => {
    await expect(
      command.execute({ id: "00000000-0000-7000-8000-000000000000", expectedVersion: 1 })
    ).rejects.toThrow(NotFoundEntityError);
    await expect(
      command.execute({ id: "00000000-0000-7000-8000-000000000000", expectedVersion: 1 })
    ).rejects.toThrow("役割が見つかりません");
  });

  it("stale な expectedVersion での削除は ConflictError（expectedVersion 素通しの検証）", async () => {
    const role = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("競合テスト役割"),
      new PositionId(kachouPositionId)
    );
    await roleRepository.insert(role);

    // 別ユーザーが更新して version を 1 → 2 へ進める
    await prisma.role.update({
      where: { id: role.id.value },
      data: { version: { increment: 1 } },
    });

    // stale な version 1 のまま削除 → 競合として弾かれる（素通しが効いている証左）
    await expect(command.execute({ id: role.id.value, expectedVersion: 1 })).rejects.toThrow(
      ConflictError
    );

    // 行は残存している（誤削除が防止された）
    const stillThere = await roleRepository.findById(role.id);
    expect(stillThere).not.toBeNull();
  });

  it("下位役割がある場合は削除できない", async () => {
    const buchouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("テスト部長"),
      new PositionId(buchouPositionId)
    );
    await roleRepository.insert(buchouRole);

    const kachouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("テスト課長"),
      new PositionId(kachouPositionId),
      buchouRole.id
    );
    await roleRepository.insert(kachouRole);

    await expect(command.execute({ id: buchouRole.id.value, expectedVersion: 1 })).rejects.toThrow(
      BusinessRuleViolationError
    );
    await expect(command.execute({ id: buchouRole.id.value, expectedVersion: 1 })).rejects.toThrow(
      "下位役割が存在するため"
    );
  });
});
