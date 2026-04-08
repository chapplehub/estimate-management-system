import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import { ValidationError } from "@server/shared/errors/DomainError";
import { DepartmentCdDuplicationCheckDomainService } from "@subdomains/department/domain/services/DepartmentCdDuplicationCheckDomainService";
import { DepartmentCd } from "@subdomains/department/domain/values/DepartmentCd";
import { PrismaDepartmentRepository } from "@subdomains/department/infrastructure/prisma/PrismaDepartmentRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreateDepartmentCommand } from "../CreateDepartmentCommand";

describe("CreateDepartmentCommand", () => {
  let command: CreateDepartmentCommand;
  let repository: PrismaDepartmentRepository;

  const TEST_CODES = ["DEPT991", "DEPT992"];

  async function cleanup() {
    await prisma.department.deleteMany({
      where: { parentId: { not: null }, departmentCd: { in: TEST_CODES } },
    });
    await prisma.department.deleteMany({
      where: { departmentCd: { in: TEST_CODES } },
    });
  }

  beforeEach(async () => {
    await cleanup();

    repository = new PrismaDepartmentRepository();
    const duplicationCheckService = new DepartmentCdDuplicationCheckDomainService(repository);
    command = new CreateDepartmentCommand(repository, duplicationCheckService);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("部署を新規登録できる", async () => {
    await command.execute({
      departmentCd: TEST_CODES[0],
      name: "テスト営業部",
      abbreviation: "テスト営業",
    });

    const saved = await repository.findByDepartmentCd(new DepartmentCd(TEST_CODES[0]));
    expect(saved).not.toBeNull();
    expect(saved?.departmentCd.value).toBe(TEST_CODES[0]);
    expect(saved?.name.value).toBe("テスト営業部");
    expect(saved?.abbreviation.value).toBe("テスト営業");
    expect(saved?.parentId).toBeNull();
  });

  it("親部署を指定して登録できる", async () => {
    const parentId = generateId();
    await prisma.department.create({
      data: {
        id: parentId,
        departmentCd: TEST_CODES[0],
        name: "親部署",
        abbreviation: "親",
        isActive: true,
      },
    });

    await command.execute({
      departmentCd: TEST_CODES[1],
      name: "子部署",
      abbreviation: "子",
      parentId,
    });

    const saved = await repository.findByDepartmentCd(new DepartmentCd(TEST_CODES[1]));
    expect(saved).not.toBeNull();
    expect(saved?.parentId).toBe(parentId);
  });

  it("既に存在する部署コードの場合はエラー", async () => {
    await command.execute({
      departmentCd: TEST_CODES[0],
      name: "最初の部署",
      abbreviation: "最初",
    });

    await expect(
      command.execute({
        departmentCd: TEST_CODES[0],
        name: "重複部署",
        abbreviation: "重複",
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        departmentCd: TEST_CODES[0],
        name: "重複部署",
        abbreviation: "重複",
      })
    ).rejects.toThrow("既に存在する部署コードです");
  });

  it("存在しない親部署を指定するとエラー", async () => {
    await expect(
      command.execute({
        departmentCd: TEST_CODES[0],
        name: "営業部",
        abbreviation: "営業",
        parentId: "00000000-0000-7000-8000-000000000000",
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        departmentCd: TEST_CODES[0],
        name: "営業部",
        abbreviation: "営業",
        parentId: "00000000-0000-7000-8000-000000000000",
      })
    ).rejects.toThrow("親部署が存在しません");
  });

  it("無効な部署を親部署に指定するとエラー", async () => {
    const inactiveParentId = generateId();
    await prisma.department.create({
      data: {
        id: inactiveParentId,
        departmentCd: TEST_CODES[0],
        name: "無効部署",
        abbreviation: "無効",
        isActive: false,
      },
    });

    await expect(
      command.execute({
        departmentCd: TEST_CODES[1],
        name: "子部署",
        abbreviation: "子",
        parentId: inactiveParentId,
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        departmentCd: TEST_CODES[1],
        name: "子部署",
        abbreviation: "子",
        parentId: inactiveParentId,
      })
    ).rejects.toThrow("無効な部署を親部署に設定することはできません");
  });
});
