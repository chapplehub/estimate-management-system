import prisma from "@server/prisma";
import { Role } from "@subdomains/role/domain/entities/Role";
import { RoleCd } from "@subdomains/role/domain/values/RoleCd";
import { RoleName } from "@subdomains/role/domain/values/RoleName";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaPositionRepository } from "@subdomains/role/infrastructure/prisma/PrismaPositionRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SuperiorRoleValidationDomainService } from "../SuperiorRoleValidationDomainService";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";

describe("SuperiorRoleValidationDomainService", () => {
  let service: SuperiorRoleValidationDomainService;
  let roleRepository: PrismaRoleRepository;

  const TEST_ROLE_CDS = ["ROLE996", "ROLE997"];

  // シードデータの役職ID
  let kachouPositionId: string; // 課長 (POS001) - 上位: 部長
  let buchouPositionId: string; // 部長 (POS002) - 上位: 本部長
  let shachouPositionId: string; // 社長 (POS004) - 上位: null

  async function cleanup() {
    await prisma.role.deleteMany({
      where: { roleCd: { in: TEST_ROLE_CDS } },
    });
  }

  beforeEach(async () => {
    await cleanup();

    const [kachou, buchou, shachou] = await Promise.all([
      prisma.position.findUnique({ where: { positionCd: "POS001" } }),
      prisma.position.findUnique({ where: { positionCd: "POS002" } }),
      prisma.position.findUnique({ where: { positionCd: "POS004" } }),
    ]);
    kachouPositionId = kachou!.id;
    buchouPositionId = buchou!.id;
    shachouPositionId = shachou!.id;

    roleRepository = new PrismaRoleRepository();
    const positionRepository = new PrismaPositionRepository();
    service = new SuperiorRoleValidationDomainService(roleRepository, positionRepository);
  });

  afterEach(cleanup);

  it("上位役職に属する役割を上位役割に指定できる", async () => {
    // 部長ポジションの役割を作成（課長の上位役割候補）
    const buchouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("テスト部長"),
      buchouPositionId
    );
    await roleRepository.save(buchouRole);

    // 課長ポジションから部長ポジションの役割を上位に指定 → OK
    await expect(service.execute(kachouPositionId, buchouRole.id)).resolves.not.toThrow();
  });

  it("最上位の役職には上位役割を設定できない", async () => {
    const someRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("テスト役割"),
      buchouPositionId
    );
    await roleRepository.save(someRole);

    // 社長ポジションから上位役割を指定 → エラー
    await expect(service.execute(shachouPositionId, someRole.id)).rejects.toThrow(
      BusinessRuleViolationError
    );
    await expect(service.execute(shachouPositionId, someRole.id)).rejects.toThrow(
      "最上位の役職には上位役割を設定できません"
    );
  });

  it("上位役職に属さない役割を上位に指定するとエラー", async () => {
    // 課長ポジションの役割を作成
    const kachouRole = Role.create(
      new RoleCd(TEST_ROLE_CDS[0]),
      new RoleName("テスト課長"),
      kachouPositionId
    );
    await roleRepository.save(kachouRole);

    // 課長ポジションから同じ課長ポジションの役割を上位に指定 → エラー
    // （課長の上位は部長でなければならない）
    await expect(service.execute(kachouPositionId, kachouRole.id)).rejects.toThrow(
      BusinessRuleViolationError
    );
    await expect(service.execute(kachouPositionId, kachouRole.id)).rejects.toThrow(
      "上位役割に指定できるのは、選択した役職の上位役職に属する役割のみです"
    );
  });

  it("存在しない上位役割を指定するとエラー", async () => {
    await expect(service.execute(kachouPositionId, "non-existent-id")).rejects.toThrow(
      BusinessRuleViolationError
    );
    await expect(service.execute(kachouPositionId, "non-existent-id")).rejects.toThrow(
      "上位役割が存在しません"
    );
  });
});
