import prisma from "@server/prisma";
import { BusinessRuleViolationError, ValidationError } from "@server/shared/errors/DomainError";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaPositionRepository } from "@subdomains/role/infrastructure/prisma/PrismaPositionRepository";
import { RoleNameDuplicationCheckDomainService } from "@subdomains/role/domain/services/RoleNameDuplicationCheckDomainService";
import { SuperiorRoleValidationDomainService } from "@subdomains/role/domain/services/SuperiorRoleValidationDomainService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateRoleCommand } from "../UpdateRoleCommand";

describe("UpdateRoleCommand", () => {
  let command: UpdateRoleCommand;
  let roleRepository: PrismaRoleRepository;

  const TEST_ROLE_CDS = ["ROLE971", "ROLE972", "ROLE973"];

  let kachouPositionId: string;
  let buchouPositionId: string;

  async function cleanup() {
    // 下位役割から削除（FK制約のため）
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
    const positionRepository = new PrismaPositionRepository();
    command = new UpdateRoleCommand(
      roleRepository,
      new RoleNameDuplicationCheckDomainService(roleRepository),
      new SuperiorRoleValidationDomainService(roleRepository, positionRepository)
    );
  });

  afterEach(cleanup);

  it("役割名を更新できる", async () => {
    const role = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("更新前の名前"),
      kachouPositionId
    );
    await roleRepository.save(role);

    const updated = await command.execute({
      id: role.id,
      name: "更新後の名前",
    });

    expect(updated.name.value).toBe("更新後の名前");
  });

  it("上位役割を更新できる", async () => {
    const buchouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("テスト部長"),
      buchouPositionId
    );
    await roleRepository.save(buchouRole);

    const kachouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("テスト課長"),
      kachouPositionId
    );
    await roleRepository.save(kachouRole);

    const updated = await command.execute({
      id: kachouRole.id,
      superiorRoleId: buchouRole.id,
    });

    expect(updated.superiorRoleId).toBe(buchouRole.id);
  });

  it("存在しない役割を更新しようとするとエラー", async () => {
    await expect(
      command.execute({
        id: "non-existent-id",
        name: "テスト",
      })
    ).rejects.toThrow(NotFoundEntityError);
  });

  it("重複する役割名に更新しようとするとエラー", async () => {
    const role1 = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("既存の役割名"),
      kachouPositionId
    );
    await roleRepository.save(role1);

    const role2 = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("変更前の名前"),
      kachouPositionId
    );
    await roleRepository.save(role2);

    await expect(
      command.execute({
        id: role2.id,
        name: "既存の役割名",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("自分自身の名前で更新しても重複エラーにならない", async () => {
    const role = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("テスト役割"),
      kachouPositionId
    );
    await roleRepository.save(role);

    const updated = await command.execute({
      id: role.id,
      name: "テスト役割",
    });

    expect(updated.name.value).toBe("テスト役割");
  });

  it("自分自身を上位役割に指定するとエラー", async () => {
    const buchouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("テスト部長"),
      buchouPositionId
    );
    await roleRepository.save(buchouRole);

    await expect(
      command.execute({
        id: buchouRole.id,
        superiorRoleId: buchouRole.id,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("下位役割を上位役割に指定するとエラー（チェーン循環防止）", async () => {
    // 部長 ← 課長 の階層で、部長の上位を課長にしようとする → B → K → B の循環
    const buchouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("循環テスト部長"),
      buchouPositionId
    );
    await roleRepository.save(buchouRole);

    const kachouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("循環テスト課長"),
      kachouPositionId,
      buchouRole.id
    );
    await roleRepository.save(kachouRole);

    await expect(
      command.execute({
        id: buchouRole.id,
        superiorRoleId: kachouRole.id,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("同一役職レベルの役割を上位役割に指定するとエラー", async () => {
    const kachouRole1 = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("同一レベルA課長"),
      kachouPositionId
    );
    await roleRepository.save(kachouRole1);

    const kachouRole2 = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("同一レベルB課長"),
      kachouPositionId
    );
    await roleRepository.save(kachouRole2);

    // 課長の上位は部長でなければならないため、同一役職レベルは設定不可
    await expect(
      command.execute({
        id: kachouRole1.id,
        superiorRoleId: kachouRole2.id,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });
});
