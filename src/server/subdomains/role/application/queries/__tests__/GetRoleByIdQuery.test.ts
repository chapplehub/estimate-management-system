import prisma from "@server/prisma";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetRoleByIdQuery } from "../GetRoleByIdQuery";

describe("GetRoleByIdQuery", () => {
  let query: GetRoleByIdQuery;
  let roleRepository: PrismaRoleRepository;

  const TEST_ROLE_CDS = ["ROLE931"];

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
    query = new GetRoleByIdQuery(new PrismaRoleQueryService());
  });

  afterEach(cleanup);

  it("IDで役割を取得できる", async () => {
    const role = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("ID取得テスト役割"),
      new PositionId(kachouPositionId)
    );
    await roleRepository.save(role);

    const result = await query.execute({ id: role.id.value });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(role.id.value);
    expect(result?.roleCd).toBe(TEST_ROLE_CDS[0]);
    expect(result?.name).toBe("ID取得テスト役割");
    expect(result?.positionId).toBe(kachouPositionId);
    expect(result?.positionName).toBe("課長");
    expect(result?.superiorRoleId).toBeNull();
    expect(result?.superiorRoleName).toBeNull();
    expect(result?.createdAt).toBeInstanceOf(Date);
    expect(result?.updatedAt).toBeInstanceOf(Date);
  });

  it("存在しないIDの場合nullを返す", async () => {
    const result = await query.execute({ id: "00000000-0000-7000-8000-000000000000" });
    expect(result).toBeNull();
  });
});
