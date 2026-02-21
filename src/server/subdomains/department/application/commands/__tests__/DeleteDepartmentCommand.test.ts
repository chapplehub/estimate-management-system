import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { ValidationError } from "@server/shared/errors/DomainError";
import { PrismaDepartmentRepository } from "@subdomains/department/infrastructure/prisma/PrismaDepartmentRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeleteDepartmentCommand } from "../DeleteDepartmentCommand";

describe("DeleteDepartmentCommand", () => {
  let command: DeleteDepartmentCommand;
  let repository: PrismaDepartmentRepository;

  const TEST_CODES = ["DEPT996", "DEPT997"];

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
    command = new DeleteDepartmentCommand(repository);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("部署を削除できる", async () => {
    const deptId = createId();
    await prisma.department.create({
      data: {
        id: deptId,
        departmentCd: TEST_CODES[0],
        name: "削除テスト部署",
        abbreviation: "削除テスト",
        displayOrder: 1,
        isActive: true,
      },
    });

    await command.execute({ id: deptId });

    const deleted = await prisma.department.findUnique({ where: { id: deptId } });
    expect(deleted).toBeNull();
  });

  it("存在しない部署を削除しようとするとエラー", async () => {
    await expect(command.execute({ id: "non-existent-id" })).rejects.toThrow(NotFoundEntityError);
  });

  it("子部署がある場合は削除できない", async () => {
    const parentId = createId();
    const childId = createId();

    await prisma.department.create({
      data: {
        id: parentId,
        departmentCd: TEST_CODES[0],
        name: "親部署",
        abbreviation: "親",
        displayOrder: 1,
        isActive: true,
      },
    });
    await prisma.department.create({
      data: {
        id: childId,
        departmentCd: TEST_CODES[1],
        name: "子部署",
        abbreviation: "子",
        displayOrder: 1,
        isActive: true,
        parentId,
      },
    });

    await expect(command.execute({ id: parentId })).rejects.toThrow(ValidationError);
  });
});
