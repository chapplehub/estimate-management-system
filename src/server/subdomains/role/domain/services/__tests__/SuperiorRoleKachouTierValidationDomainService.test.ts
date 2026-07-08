import prisma from "@server/prisma";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PositionId } from "@subdomains/position/domain/values/PositionId";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaPositionRepository } from "@subdomains/role/infrastructure/prisma/PrismaPositionRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SuperiorRoleKachouTierValidationDomainService } from "../SuperiorRoleKachouTierValidationDomainService";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";

/**
 * 課員の上位役割を課長級に限る検証（ADR-20260707-k4e）。
 *
 * 「課員に明示できる上位役割は課長級（役職階層の葉に属する役割）のみ」という
 * ビジネスルールを検証する。既存 SuperiorRoleValidationDomainService（役割の上位役割は
 * 役職の1段上）と同型のティア妥当性検証の兄弟。
 */
describe("SuperiorRoleKachouTierValidationDomainService", () => {
  let service: SuperiorRoleKachouTierValidationDomainService;
  let roleRepository: PrismaRoleRepository;

  const TEST_ROLE_CDS = ["ROLE993", "ROLE994"];

  let kachouPositionId: string; // 課長 (POS001) - 葉
  let buchouPositionId: string; // 部長 (POS002) - 葉ではない

  async function cleanup() {
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
    service = new SuperiorRoleKachouTierValidationDomainService(roleRepository, positionRepository);
  });

  afterEach(cleanup);

  it("課長級（葉役職に属する）役割は上位役割に指定できる", async () => {
    const kachouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("テスト課長"),
      new PositionId(kachouPositionId)
    );
    await roleRepository.insert(kachouRole);

    await expect(service.execute(kachouRole.id)).resolves.not.toThrow();
  });

  it("課長級でない（部長級）役割を指定するとエラー", async () => {
    const buchouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("テスト部長"),
      new PositionId(buchouPositionId)
    );
    await roleRepository.insert(buchouRole);

    await expect(service.execute(buchouRole.id)).rejects.toThrow(BusinessRuleViolationError);
    await expect(service.execute(buchouRole.id)).rejects.toThrow("課長級");
  });

  it("存在しない役割を指定するとエラー", async () => {
    await expect(
      service.execute(new RoleId("00000000-0000-7000-8000-000000000000"))
    ).rejects.toThrow(BusinessRuleViolationError);
  });
});
