import prisma from "@server/prisma";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RoleNameDuplicationCheckDomainService } from "../RoleNameDuplicationCheckDomainService";

describe("RoleNameDuplicationCheckDomainService", () => {
  let service: RoleNameDuplicationCheckDomainService;
  let repository: PrismaRoleRepository;

  const TEST_ROLE_CD = "ROLE997";
  const TEST_ROLE_NAME = "テスト用ユニーク役割名";
  const TEST_POSITION_CD = "POS001";

  let positionId: string;

  async function cleanup() {
    await prisma.role.deleteMany({
      where: { roleCd: TEST_ROLE_CD },
    });
  }

  beforeEach(async () => {
    await cleanup();

    const position = await prisma.position.findUnique({
      where: { positionCd: TEST_POSITION_CD },
    });
    positionId = position!.id;

    repository = new PrismaRoleRepository();
    service = new RoleNameDuplicationCheckDomainService(repository);
  });

  afterEach(cleanup);

  it("役割名が存在しない場合は false を返す", async () => {
    const isDuplicated = await service.execute(TEST_ROLE_NAME);
    expect(isDuplicated).toBe(false);
  });

  it("役割名が既に存在する場合は true を返す", async () => {
    const role = Role.create(
      new RoleCd(TEST_ROLE_CD),
      new RoleName(TEST_ROLE_NAME),
      new PositionId(positionId)
    );
    await repository.insert(role);

    const isDuplicated = await service.execute(TEST_ROLE_NAME);
    expect(isDuplicated).toBe(true);
  });

  it("excludeIdで自分自身を除外できる", async () => {
    const role = Role.create(
      new RoleCd(TEST_ROLE_CD),
      new RoleName(TEST_ROLE_NAME),
      new PositionId(positionId)
    );
    const savedRole = await repository.insert(role);

    const isDuplicated = await service.execute(TEST_ROLE_NAME, savedRole.id);
    expect(isDuplicated).toBe(false);
  });
});
