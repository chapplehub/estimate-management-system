import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { PrismaDepartmentRepository } from "@subdomains/department/infrastructure/prisma/PrismaDepartmentRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateDepartmentCommand } from "../UpdateDepartmentCommand";

describe("UpdateDepartmentCommand", () => {
  let command: UpdateDepartmentCommand;
  let repository: PrismaDepartmentRepository;

  const TEST_CODES = ["DEPT993", "DEPT994", "DEPT995"];
  let baseDeptId: string;

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
    command = new UpdateDepartmentCommand(repository);

    baseDeptId = generateId();
    await prisma.department.create({
      data: {
        id: baseDeptId,
        departmentCd: TEST_CODES[0],
        name: "営業部",
        abbreviation: "営業",
        isActive: true,
      },
    });
  });

  afterEach(async () => {
    await cleanup();
  });

  it("部署名を更新できる", async () => {
    const result = await command.execute({
      id: baseDeptId,
      name: "新営業部",
    });

    expect(result.name.value).toBe("新営業部");
  });

  it("略称を更新できる", async () => {
    const result = await command.execute({
      id: baseDeptId,
      abbreviation: "新営業",
    });

    expect(result.abbreviation.value).toBe("新営業");
  });

  it("存在しない部署を更新しようとするとエラー", async () => {
    await expect(
      command.execute({
        id: "00000000-0000-7000-8000-000000000000",
        name: "新営業部",
      })
    ).rejects.toThrow(NotFoundEntityError);
  });

  it("部署を有効化できる", async () => {
    // まず無効化
    await prisma.department.update({
      where: { id: baseDeptId },
      data: { isActive: false },
    });

    const result = await command.execute({
      id: baseDeptId,
      isActive: true,
    });

    expect(result.isActive).toBe(true);
  });

  it("部署を無効化できる", async () => {
    const result = await command.execute({
      id: baseDeptId,
      isActive: false,
    });

    expect(result.isActive).toBe(false);
  });

  it("有効な子部署がある場合は無効化できない", async () => {
    const childId = generateId();
    await prisma.department.create({
      data: {
        id: childId,
        departmentCd: TEST_CODES[1],
        name: "子部署",
        abbreviation: "子",
        isActive: true,
        parentId: baseDeptId,
      },
    });

    await expect(
      command.execute({
        id: baseDeptId,
        isActive: false,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("親部署を変更できる", async () => {
    const newParentId = generateId();
    await prisma.department.create({
      data: {
        id: newParentId,
        departmentCd: TEST_CODES[1],
        name: "新親部署",
        abbreviation: "新親",
        isActive: true,
      },
    });

    const result = await command.execute({
      id: baseDeptId,
      parentId: newParentId,
    });

    expect(result.parentId).toBe(newParentId);
  });

  it("自分自身を親部署に設定するとエラー", async () => {
    await expect(
      command.execute({
        id: baseDeptId,
        parentId: baseDeptId,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("存在しない部署を親部署に設定するとエラー", async () => {
    await expect(
      command.execute({
        id: baseDeptId,
        parentId: "00000000-0000-7000-8000-000000000001",
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("無効な部署を親部署に設定するとエラー", async () => {
    const inactiveParentId = generateId();
    await prisma.department.create({
      data: {
        id: inactiveParentId,
        departmentCd: TEST_CODES[1],
        name: "無効親部署",
        abbreviation: "無効親",
        isActive: false,
      },
    });

    await expect(
      command.execute({
        id: baseDeptId,
        parentId: inactiveParentId,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });

  it("循環参照になる親部署を設定するとエラー", async () => {
    // A → B → C の3階層を作成し、AのparentをCに変更 → 循環参照
    const deptBId = generateId();
    const deptCId = generateId();

    await prisma.department.create({
      data: {
        id: deptBId,
        departmentCd: TEST_CODES[1],
        name: "部署B",
        abbreviation: "B",
        isActive: true,
        parentId: baseDeptId,
      },
    });
    await prisma.department.create({
      data: {
        id: deptCId,
        departmentCd: TEST_CODES[2],
        name: "部署C",
        abbreviation: "C",
        isActive: true,
        parentId: deptBId,
      },
    });

    await expect(
      command.execute({
        id: baseDeptId,
        parentId: deptCId,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
  });
});
