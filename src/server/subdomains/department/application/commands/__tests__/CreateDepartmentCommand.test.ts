import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateDepartmentCommand } from "../CreateDepartmentCommand";
import { IDepartmentRepository } from "@subdomains/department/domain/repositories/IDepartmentRepository";
import { DepartmentCdDuplicationCheckDomainService } from "@subdomains/department/domain/services/DepartmentCdDuplicationCheckDomainService";
import { Department } from "@subdomains/department/domain/entities/Department";
import { DepartmentCd } from "@subdomains/department/domain/values/DepartmentCd";
import { DepartmentName } from "@subdomains/department/domain/values/DepartmentName";
import { Abbreviation } from "@subdomains/department/domain/values/Abbreviation";
import { ValidationError } from "@server/shared/errors/DomainError";

describe("CreateDepartmentCommand", () => {
  let command: CreateDepartmentCommand;
  let mockRepository: IDepartmentRepository;
  let mockDuplicationCheckService: DepartmentCdDuplicationCheckDomainService;

  beforeEach(() => {
    mockRepository = {
      save: vi.fn().mockImplementation((dept) => Promise.resolve(dept)),
      delete: vi.fn(),
      findById: vi.fn(),
      findByDepartmentCd: vi.fn(),
      findChildren: vi.fn(),
      findRootDepartments: vi.fn(),
    };

    mockDuplicationCheckService = {
      execute: vi.fn(),
    } as unknown as DepartmentCdDuplicationCheckDomainService;

    command = new CreateDepartmentCommand(
      mockRepository,
      mockDuplicationCheckService
    );
  });

  it("部署を新規登録できる", async () => {
    vi.mocked(mockDuplicationCheckService.execute).mockResolvedValue(false);

    const result = await command.execute({
      departmentCd: "DEPT001",
      name: "営業部",
      abbreviation: "営業",
    });

    expect(result).toBeInstanceOf(Department);
    expect(result.departmentCd.value).toBe("DEPT001");
    expect(result.name.value).toBe("営業部");
    expect(result.abbreviation.value).toBe("営業");
    expect(result.displayOrder).toBe(0);
    expect(result.parentId).toBeNull();
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it("表示順と親部署を指定して登録できる", async () => {
    vi.mocked(mockDuplicationCheckService.execute).mockResolvedValue(false);
    const parentDepartment = Department.create(
      new DepartmentCd("DEPT001"),
      new DepartmentName("本社"),
      new Abbreviation("本社")
    );
    vi.mocked(mockRepository.findById).mockResolvedValue(parentDepartment);

    const result = await command.execute({
      departmentCd: "DEPT002",
      name: "営業部",
      abbreviation: "営業",
      displayOrder: 10,
      parentId: parentDepartment.id,
    });

    expect(result.displayOrder).toBe(10);
    expect(result.parentId).toBe(parentDepartment.id);
  });

  it("既に存在する部署コードの場合はエラー", async () => {
    vi.mocked(mockDuplicationCheckService.execute).mockResolvedValue(true);

    await expect(
      command.execute({
        departmentCd: "DEPT001",
        name: "営業部",
        abbreviation: "営業",
      })
    ).rejects.toThrow(ValidationError);

    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it("存在しない親部署を指定するとエラー", async () => {
    vi.mocked(mockDuplicationCheckService.execute).mockResolvedValue(false);
    vi.mocked(mockRepository.findById).mockResolvedValue(null);

    await expect(
      command.execute({
        departmentCd: "DEPT001",
        name: "営業部",
        abbreviation: "営業",
        parentId: "non-existent-id",
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        departmentCd: "DEPT001",
        name: "営業部",
        abbreviation: "営業",
        parentId: "non-existent-id",
      })
    ).rejects.toThrow("親部署が存在しません");
  });

  it("無効な部署を親部署に指定するとエラー", async () => {
    vi.mocked(mockDuplicationCheckService.execute).mockResolvedValue(false);
    const inactiveParent = Department.reconstruct(
      "parent-id",
      new DepartmentCd("DEPT001"),
      new DepartmentName("旧部署"),
      new Abbreviation("旧"),
      0,
      false, // 無効
      null,
      new Date(),
      new Date()
    );
    vi.mocked(mockRepository.findById).mockResolvedValue(inactiveParent);

    await expect(
      command.execute({
        departmentCd: "DEPT002",
        name: "営業部",
        abbreviation: "営業",
        parentId: "parent-id",
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        departmentCd: "DEPT002",
        name: "営業部",
        abbreviation: "営業",
        parentId: "parent-id",
      })
    ).rejects.toThrow("無効な部署を親部署に設定することはできません");
  });
});
