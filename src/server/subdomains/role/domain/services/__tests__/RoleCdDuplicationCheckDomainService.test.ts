import prisma from "@server/prisma";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RoleCdDuplicationCheckDomainService } from "../RoleCdDuplicationCheckDomainService";

describe("RoleCdDuplicationCheckDomainService", () => {
  let service: RoleCdDuplicationCheckDomainService;
  let repository: PrismaRoleRepository;

  const TEST_ROLE_CD = "ROLE998";
  const TEST_POSITION_CD = "POS001"; // シードデータの課長

  let positionId: string;

  async function cleanup() {
    await prisma.role.deleteMany({
      where: { roleCd: TEST_ROLE_CD },
    });
  }

  beforeEach(async () => {
    await cleanup();

    // シードデータのPositionを取得
    const position = await prisma.position.findUnique({
      where: { positionCd: TEST_POSITION_CD },
    });
    positionId = position!.id;

    repository = new PrismaRoleRepository();
    service = new RoleCdDuplicationCheckDomainService(repository);
  });

  afterEach(cleanup);

  it("役割コードが存在しない場合は false を返す", async () => {
    const isDuplicated = await service.execute(new RoleCd(TEST_ROLE_CD));
    expect(isDuplicated).toBe(false);
  });

  it("役割コードが既に存在する場合は true を返す", async () => {
    const role = Role.create(
      new RoleCd(TEST_ROLE_CD),
      new RoleName("テスト役割"),
      new PositionId(positionId)
    );
    await repository.insert(role);

    const isDuplicated = await service.execute(new RoleCd(TEST_ROLE_CD));
    expect(isDuplicated).toBe(true);
  });
});
