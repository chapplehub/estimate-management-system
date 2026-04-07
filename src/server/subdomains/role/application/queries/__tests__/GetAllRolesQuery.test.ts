import prisma from "@server/prisma";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetAllRolesQuery } from "../GetAllRolesQuery";

describe("GetAllRolesQuery", () => {
  let query: GetAllRolesQuery;
  let roleRepository: PrismaRoleRepository;

  const TEST_ROLE_CDS = ["ROLE941", "ROLE942"];

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
    query = new GetAllRolesQuery(new PrismaRoleQueryService());
  });

  afterEach(cleanup);

  it("全役割を取得できる", async () => {
    const role1 = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("全取得テストA"),
      new PositionId(kachouPositionId)
    );
    const role2 = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("全取得テストB"),
      new PositionId(kachouPositionId)
    );
    await roleRepository.save(role1);
    await roleRepository.save(role2);

    const result = await query.execute({});

    const roleCds = result.map((r) => r.roleCd);
    expect(roleCds).toContain(TEST_ROLE_CDS[0]);
    expect(roleCds).toContain(TEST_ROLE_CDS[1]);
  });

  it("ソートオプションを指定できる", async () => {
    const role1 = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("全取得ソートA"),
      new PositionId(kachouPositionId)
    );
    const role2 = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("全取得ソートB"),
      new PositionId(kachouPositionId)
    );
    await roleRepository.save(role1);
    await roleRepository.save(role2);

    const result = await query.execute({
      options: { orderBy: { field: "roleCd", direction: "desc" } },
    });

    const testResults = result.filter((r) => TEST_ROLE_CDS.includes(r.roleCd));
    expect(testResults[0].roleCd).toBe(TEST_ROLE_CDS[1]);
    expect(testResults[1].roleCd).toBe(TEST_ROLE_CDS[0]);
  });
});
