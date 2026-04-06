import prisma from "@server/prisma";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetRoleByRoleCdQuery } from "../GetRoleByRoleCdQuery";

describe("GetRoleByRoleCdQuery", () => {
  let query: GetRoleByRoleCdQuery;
  let roleRepository: PrismaRoleRepository;

  const TEST_ROLE_CDS = ["ROLE943"];

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

    roleRepository = new PrismaRoleRepository();
    query = new GetRoleByRoleCdQuery(new PrismaRoleQueryService());
  });

  afterEach(cleanup);

  it("役割コードで役割を取得できる", async () => {
    const role = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("コード取得テスト役割"),
      kachouPositionId
    );
    await roleRepository.save(role);

    const result = await query.execute({ roleCd: TEST_ROLE_CDS[0] });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(role.id);
    expect(result?.roleCd).toBe(TEST_ROLE_CDS[0]);
    expect(result?.name).toBe("コード取得テスト役割");
    expect(result?.positionId).toBe(kachouPositionId);
    expect(result?.positionName).toBe("課長");
    expect(result?.superiorRoleId).toBeNull();
    expect(result?.superiorRoleName).toBeNull();
    expect(result?.createdAt).toBeInstanceOf(Date);
    expect(result?.updatedAt).toBeInstanceOf(Date);
  });

  it("存在しない役割コードの場合nullを返す", async () => {
    const result = await query.execute({ roleCd: "NON_EXISTENT_CODE" });
    expect(result).toBeNull();
  });
});
