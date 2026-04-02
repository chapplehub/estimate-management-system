import prisma from "@server/prisma";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaRoleQueryService } from "@subdomains/role/infrastructure/queries/PrismaRoleQueryService";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchRolesQuery } from "../SearchRolesQuery";

describe("SearchRolesQuery", () => {
  let query: SearchRolesQuery;
  let roleRepository: PrismaRoleRepository;

  const TEST_ROLE_CDS = ["ROLE951", "ROLE952", "ROLE953"];

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
    query = new SearchRolesQuery(new PrismaRoleQueryService());
  });

  afterEach(cleanup);

  it("役割名で部分一致検索できる", async () => {
    const role1 = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("検索大阪営業課長"),
      kachouPositionId
    );
    const role2 = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("検索東京開発課長"),
      kachouPositionId
    );
    await roleRepository.save(role1);
    await roleRepository.save(role2);

    const result = await query.execute({ criteria: { name: "大阪" } });

    const roleCds = result.map((r) => r.roleCd);
    expect(roleCds).toContain(TEST_ROLE_CDS[0]);
    expect(roleCds).not.toContain(TEST_ROLE_CDS[1]);
  });

  it("役割コードで完全一致検索できる", async () => {
    const role = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("検索コードテスト"),
      kachouPositionId
    );
    await roleRepository.save(role);

    const result = await query.execute({ criteria: { roleCd: TEST_ROLE_CDS[0] } });

    expect(result.length).toBe(1);
    expect(result[0].roleCd).toBe(TEST_ROLE_CDS[0]);
  });

  it("役職IDで検索できる", async () => {
    const role1 = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("検索役職課長"),
      kachouPositionId
    );
    const role2 = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("検索役職部長"),
      buchouPositionId
    );
    await roleRepository.save(role1);
    await roleRepository.save(role2);

    const result = await query.execute({ criteria: { positionId: kachouPositionId } });

    const roleCds = result.map((r) => r.roleCd);
    expect(roleCds).toContain(TEST_ROLE_CDS[0]);
    expect(roleCds).not.toContain(TEST_ROLE_CDS[1]);
  });

  it("上位役割IDで検索できる", async () => {
    const buchouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("検索上位部長"),
      buchouPositionId
    );
    await roleRepository.save(buchouRole);

    const kachouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("検索上位課長"),
      kachouPositionId,
      buchouRole.id
    );
    await roleRepository.save(kachouRole);

    const result = await query.execute({ criteria: { superiorRoleId: buchouRole.id } });

    const roleCds = result.map((r) => r.roleCd);
    expect(roleCds).toContain(TEST_ROLE_CDS[1]);
    expect(roleCds).not.toContain(TEST_ROLE_CDS[0]);
  });

  it("上位役割がnullのルート役割のみ検索できる", async () => {
    const buchouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("検索ルート部長"),
      buchouPositionId
    );
    await roleRepository.save(buchouRole);

    const kachouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("検索ルート課長"),
      kachouPositionId,
      buchouRole.id
    );
    await roleRepository.save(kachouRole);

    const result = await query.execute({ criteria: { superiorRoleId: null } });

    const roleCds = result.map((r) => r.roleCd);
    expect(roleCds).toContain(TEST_ROLE_CDS[0]);
    expect(roleCds).not.toContain(TEST_ROLE_CDS[1]);
  });

  it("上位役割名がDTOに含まれる", async () => {
    const buchouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("検索DTO部長"),
      buchouPositionId
    );
    await roleRepository.save(buchouRole);

    const kachouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("検索DTO課長"),
      kachouPositionId,
      buchouRole.id
    );
    await roleRepository.save(kachouRole);

    const result = await query.execute({ criteria: { roleCd: TEST_ROLE_CDS[1] } });

    expect(result[0].superiorRoleName).toBe("検索DTO部長");
    expect(result[0].positionName).toBe("課長");
  });

  it("条件に一致する役割がない場合は空配列を返す", async () => {
    const result = await query.execute({ criteria: { name: "存在しない検索役割名" } });
    expect(result).toEqual([]);
  });

  it("検索条件とオプションを組み合わせて検索できる", async () => {
    const role1 = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("検索オプA課長"),
      kachouPositionId
    );
    const role2 = Role.create(
      new RoleCd(TEST_ROLE_CDS[1]),
      new RoleName("検索オプB課長"),
      kachouPositionId
    );
    await roleRepository.save(role1);
    await roleRepository.save(role2);

    const result = await query.execute({
      criteria: { name: "検索オプ" },
      options: { limit: 1, orderBy: { field: "roleCd", direction: "asc" } },
    });

    expect(result.length).toBe(1);
  });
});
