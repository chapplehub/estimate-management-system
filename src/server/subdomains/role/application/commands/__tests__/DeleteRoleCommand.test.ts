import prisma from "@server/prisma";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
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
      kachouPositionId
    );
    await roleRepository.save(role);

    await command.execute({ id: role.id });

    const deleted = await roleRepository.findById(role.id);
    expect(deleted).toBeNull();
  });

  it("存在しない役割を削除しようとするとエラー", async () => {
    await expect(command.execute({ id: "00000000-0000-7000-8000-000000000000" })).rejects.toThrow(
      NotFoundEntityError
    );
  });

  it("下位役割がある場合は削除できない", async () => {
    const buchouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("テスト部長"),
      buchouPositionId
    );
    await roleRepository.save(buchouRole);

    const kachouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("テスト課長"),
      kachouPositionId,
      buchouRole.id
    );
    await roleRepository.save(kachouRole);

    await expect(command.execute({ id: buchouRole.id })).rejects.toThrow(
      BusinessRuleViolationError
    );
    await expect(command.execute({ id: buchouRole.id })).rejects.toThrow("下位役割が存在するため");
  });
});
