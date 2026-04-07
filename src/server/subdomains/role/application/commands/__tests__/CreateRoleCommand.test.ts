import prisma from "@server/prisma";
import { ValidationError } from "@server/shared/errors/DomainError";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaPositionRepository } from "@subdomains/role/infrastructure/prisma/PrismaPositionRepository";
import { RoleCdDuplicationCheckDomainService } from "@subdomains/role/domain/services/RoleCdDuplicationCheckDomainService";
import { RoleNameDuplicationCheckDomainService } from "@subdomains/role/domain/services/RoleNameDuplicationCheckDomainService";
import { SuperiorRoleValidationDomainService } from "@subdomains/role/domain/services/SuperiorRoleValidationDomainService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreateRoleCommand } from "../CreateRoleCommand";

describe("CreateRoleCommand", () => {
  let command: CreateRoleCommand;
  let roleRepository: PrismaRoleRepository;

  const TEST_ROLE_CDS = ["ROLE981", "ROLE982"];

  let kachouPositionId: string;
  let buchouPositionId: string;

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

    const [kachou, buchou] = await Promise.all([
      prisma.position.findUnique({ where: { positionCd: "POS001" } }),
      prisma.position.findUnique({ where: { positionCd: "POS002" } }),
    ]);
    kachouPositionId = kachou!.id;
    buchouPositionId = buchou!.id;

    roleRepository = new PrismaRoleRepository();
    const positionRepository = new PrismaPositionRepository();
    command = new CreateRoleCommand(
      roleRepository,
      positionRepository,
      new RoleCdDuplicationCheckDomainService(roleRepository),
      new RoleNameDuplicationCheckDomainService(roleRepository),
      new SuperiorRoleValidationDomainService(roleRepository, positionRepository)
    );
  });

  afterEach(cleanup);

  it("役割を新規登録できる", async () => {
    await command.execute({
      roleCd: TEST_ROLE_CDS[0],
      name: "登録テスト課長",
      positionId: kachouPositionId,
    });

    const saved = await roleRepository.findByRoleCd(new RoleCd(TEST_ROLE_CDS[0]));
    expect(saved).not.toBeNull();
    expect(saved?.roleCd.value).toBe(TEST_ROLE_CDS[0]);
    expect(saved?.name.value).toBe("登録テスト課長");
    expect(saved?.positionId.value).toBe(kachouPositionId);
    expect(saved?.superiorRoleId).toBeNull();
  });

  it("上位役割を指定して登録できる", async () => {
    // 先に部長役割を作成
    await command.execute({
      roleCd: TEST_ROLE_CDS[0],
      name: "登録テスト部長",
      positionId: buchouPositionId,
    });
    const buchouRole = await roleRepository.findByRoleCd(new RoleCd(TEST_ROLE_CDS[0]));

    // 課長役割を部長の下に作成
    await command.execute({
      roleCd: TEST_ROLE_CDS[1],
      name: "登録テスト課長2",
      positionId: kachouPositionId,
      superiorRoleId: buchouRole!.id.value,
    });

    const saved = await roleRepository.findByRoleCd(new RoleCd(TEST_ROLE_CDS[1]));
    expect(saved?.superiorRoleId?.value).toBe(buchouRole!.id.value);
  });

  it("既に存在する役割コードの場合はエラー", async () => {
    await command.execute({
      roleCd: TEST_ROLE_CDS[0],
      name: "最初の役割",
      positionId: kachouPositionId,
    });

    await expect(
      command.execute({
        roleCd: TEST_ROLE_CDS[0],
        name: "重複役割",
        positionId: kachouPositionId,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("既に存在する役割名の場合はエラー", async () => {
    await command.execute({
      roleCd: TEST_ROLE_CDS[0],
      name: "重複テスト役割名",
      positionId: kachouPositionId,
    });

    await expect(
      command.execute({
        roleCd: TEST_ROLE_CDS[1],
        name: "重複テスト役割名",
        positionId: kachouPositionId,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("存在しない役職を指定するとエラー", async () => {
    await expect(
      command.execute({
        roleCd: TEST_ROLE_CDS[0],
        name: "登録テスト役割",
        positionId: "00000000-0000-7000-8000-000000000000",
      })
    ).rejects.toThrow(ValidationError);
  });
});
