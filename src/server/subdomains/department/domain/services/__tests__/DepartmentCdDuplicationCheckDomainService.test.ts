import prisma from "@server/prisma";
import { Department } from "@subdomains/department/domain/entities/Department";
import { DepartmentCd } from "@subdomains/department/domain/values/DepartmentCd";
import { DepartmentName } from "@subdomains/department/domain/values/DepartmentName";
import { Abbreviation } from "@subdomains/department/domain/values/Abbreviation";
import { PrismaDepartmentRepository } from "@subdomains/department/infrastructure/prisma/PrismaDepartmentRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DepartmentCdDuplicationCheckDomainService } from "../DepartmentCdDuplicationCheckDomainService";

describe("DepartmentCdDuplicationCheckDomainService", () => {
  let service: DepartmentCdDuplicationCheckDomainService;
  let repository: PrismaDepartmentRepository;

  const TEST_CODES = ["DEPT998"];

  async function cleanup() {
    await prisma.department.deleteMany({
      where: { departmentCd: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();

    repository = new PrismaDepartmentRepository();
    service = new DepartmentCdDuplicationCheckDomainService(repository);
  });

  afterEach(cleanup);

  it("部署コードが存在しない場合は false を返す", async () => {
    const isDuplicated = await service.execute(new DepartmentCd(TEST_CODES[0]));
    expect(isDuplicated).toBe(false);
  });

  it("部署コードが既に存在する場合は true を返す", async () => {
    const department = Department.create(
      new DepartmentCd(TEST_CODES[0]),
      new DepartmentName("テスト部署"),
      new Abbreviation("テスト")
    );
    await repository.save(department);

    const isDuplicated = await service.execute(new DepartmentCd(TEST_CODES[0]));
    expect(isDuplicated).toBe(true);
  });
});
