import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeleteDepartmentCommand } from "../DeleteDepartmentCommand";
import { IDepartmentRepository } from "@subdomains/department/domain/repositories/IDepartmentRepository";
import { Department } from "@subdomains/department/domain/entities/Department";
import { DepartmentCd } from "@subdomains/department/domain/values/DepartmentCd";
import { DepartmentName } from "@subdomains/department/domain/values/DepartmentName";
import { Abbreviation } from "@subdomains/department/domain/values/Abbreviation";
import { ValidationError } from "@server/shared/errors/DomainError";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";

describe("DeleteDepartmentCommand", () => {
  let command: DeleteDepartmentCommand;
  let mockRepository: IDepartmentRepository;

  const createTestDepartment = (id: string = "dept-1") => {
    return Department.reconstruct(
      id,
      new DepartmentCd("DEPT001"),
      new DepartmentName("営業部"),
      new Abbreviation("営業"),
      0,
      true,
      null,
      new Date(),
      new Date()
    );
  };

  beforeEach(() => {
    mockRepository = {
      save: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByDepartmentCd: vi.fn(),
      findChildren: vi.fn().mockResolvedValue([]),
      findRootDepartments: vi.fn(),
    };

    command = new DeleteDepartmentCommand(mockRepository);
  });

  it("部署を削除できる", async () => {
    const department = createTestDepartment();
    vi.mocked(mockRepository.findById).mockResolvedValue(department);
    vi.mocked(mockRepository.findChildren).mockResolvedValue([]);

    await command.execute({ id: "dept-1" });

    expect(mockRepository.delete).toHaveBeenCalledWith("dept-1");
  });

  it("存在しない部署を削除しようとするとエラー", async () => {
    vi.mocked(mockRepository.findById).mockResolvedValue(null);

    await expect(command.execute({ id: "non-existent" })).rejects.toThrow(
      NotFoundEntityError
    );

    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it("子部署がある場合は削除できない", async () => {
    const department = createTestDepartment();
    const childDepartment = createTestDepartment("child-1");
    vi.mocked(mockRepository.findById).mockResolvedValue(department);
    vi.mocked(mockRepository.findChildren).mockResolvedValue([childDepartment]);

    await expect(command.execute({ id: "dept-1" })).rejects.toThrow(
      ValidationError
    );
    await expect(command.execute({ id: "dept-1" })).rejects.toThrow(
      "子部署が存在するため"
    );

    expect(mockRepository.delete).not.toHaveBeenCalled();
  });
});
