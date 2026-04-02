import prisma from "@server/prisma";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GetRolesByPositionQuery } from "../GetRolesByPositionQuery";

describe("GetRolesByPositionQuery", () => {
  let query: GetRolesByPositionQuery;
  let roleRepository: PrismaRoleRepository;

  const TEST_ROLE_CDS = ["ROLE921", "ROLE922"];

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
    query = new GetRolesByPositionQuery(new PrismaRoleQueryService());
  });

  afterEach(cleanup);

  it("役職IDで役割を取得できる", async () => {
    const role1 = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("役職別テスト課長"),
      kachouPositionId
    );
    const role2 = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("役職別テスト部長"),
      buchouPositionId
    );
    await roleRepository.save(role1);
    await roleRepository.save(role2);

    const result = await query.execute({ positionId: kachouPositionId });

    const roleCds = result.map((r) => r.roleCd);
    expect(roleCds).toContain(TEST_ROLE_CDS[0]);
    expect(roleCds).not.toContain(TEST_ROLE_CDS[1]);
  });

  it("該当する役割がない場合は空配列を返す", async () => {
    const result = await query.execute({ positionId: "non-existent-position-id" });
    expect(result).toEqual([]);
  });
});
