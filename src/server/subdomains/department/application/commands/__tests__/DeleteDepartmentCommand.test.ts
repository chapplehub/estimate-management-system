import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
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
    const deptId = generateId();
    await prisma.department.create({
      data: {
        id: deptId,
        departmentCd: TEST_CODES[0],
        name: "削除テスト部署",
        abbreviation: "削除テスト",
        isActive: true,
      },
    });

    await command.execute({ id: deptId, expectedVersion: 1 });

    const deleted = await prisma.department.findUnique({ where: { id: deptId } });
    expect(deleted).toBeNull();
  });

  it("存在しない部署を削除しようとするとエラー", async () => {
    await expect(
      command.execute({ id: "00000000-0000-7000-8000-000000000000", expectedVersion: 1 })
    ).rejects.toThrow(NotFoundEntityError);
    await expect(
      command.execute({ id: "00000000-0000-7000-8000-000000000000", expectedVersion: 1 })
    ).rejects.toThrow("部署が見つかりません");
  });

  it("stale な expectedVersion での削除は ConflictError（expectedVersion 素通しの検証）", async () => {
    const deptId = generateId();
    await prisma.department.create({
      data: {
        id: deptId,
        departmentCd: TEST_CODES[0],
        name: "競合テスト部署",
        abbreviation: "競合",
        isActive: true,
      },
    });

    // 別ユーザーが更新して version を 1 → 2 へ進める
    await prisma.department.update({
      where: { id: deptId },
      data: { version: { increment: 1 } },
    });

    // stale な version 1 のまま削除 → 競合として弾かれる（素通しが効いている証左）
    await expect(command.execute({ id: deptId, expectedVersion: 1 })).rejects.toThrow(
      ConflictError
    );

    // 行は残存している（誤削除が防止された）
    const stillThere = await prisma.department.findUnique({ where: { id: deptId } });
    expect(stillThere).not.toBeNull();
  });

  it("子部署がある場合は削除できない", async () => {
    const parentId = generateId();
    const childId = generateId();

    await prisma.department.create({
      data: {
        id: parentId,
        departmentCd: TEST_CODES[0],
        name: "親部署",
        abbreviation: "親",
        isActive: true,
      },
    });
    await prisma.department.create({
      data: {
        id: childId,
        departmentCd: TEST_CODES[1],
        name: "子部署",
        abbreviation: "子",
        isActive: true,
        parentId,
      },
    });

    await expect(command.execute({ id: parentId, expectedVersion: 1 })).rejects.toThrow(
      BusinessRuleViolationError
    );
    await expect(command.execute({ id: parentId, expectedVersion: 1 })).rejects.toThrow(
      "子部署が存在するため、この部署を削除できません。先に子部署を削除してください。"
    );
  });
});
