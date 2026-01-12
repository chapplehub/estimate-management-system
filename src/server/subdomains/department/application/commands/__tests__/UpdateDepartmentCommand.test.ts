import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateDepartmentCommand } from "../UpdateDepartmentCommand";
import { IDepartmentRepository } from "@subdomains/department/domain/repositories/IDepartmentRepository";
import { Department } from "@subdomains/department/domain/entities/Department";
import { DepartmentCd } from "@subdomains/department/domain/values/DepartmentCd";
import { DepartmentName } from "@subdomains/department/domain/values/DepartmentName";
import { Abbreviation } from "@subdomains/department/domain/values/Abbreviation";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";

describe("UpdateDepartmentCommand", () => {
  let command: UpdateDepartmentCommand;
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
      save: vi.fn().mockImplementation((dept) => Promise.resolve(dept)),
      delete: vi.fn(),
      findById: vi.fn(),
      findByDepartmentCd: vi.fn(),
      findChildren: vi.fn().mockResolvedValue([]),
      findRootDepartments: vi.fn(),
    };

    command = new UpdateDepartmentCommand(mockRepository);
  });

  it("部署名を更新できる", async () => {
    const department = createTestDepartment();
    vi.mocked(mockRepository.findById).mockResolvedValue(department);

    const result = await command.execute({
      id: "dept-1",
      name: "新営業部",
    });

    expect(result.name.value).toBe("新営業部");
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it("略称を更新できる", async () => {
    const department = createTestDepartment();
    vi.mocked(mockRepository.findById).mockResolvedValue(department);

    const result = await command.execute({
      id: "dept-1",
      abbreviation: "新営業",
    });

    expect(result.abbreviation.value).toBe("新営業");
  });

  it("表示順を更新できる", async () => {
    const department = createTestDepartment();
    vi.mocked(mockRepository.findById).mockResolvedValue(department);

    const result = await command.execute({
      id: "dept-1",
      displayOrder: 10,
    });

    expect(result.displayOrder).toBe(10);
  });

  it("存在しない部署を更新しようとするとエラー", async () => {
    vi.mocked(mockRepository.findById).mockResolvedValue(null);

    await expect(
      command.execute({
        id: "non-existent",
        name: "新営業部",
      })
    ).rejects.toThrow(NotFoundEntityError);
  });

  it("部署を無効化できる", async () => {
    const department = createTestDepartment();
    vi.mocked(mockRepository.findById).mockResolvedValue(department);
    vi.mocked(mockRepository.findChildren).mockResolvedValue([]);

    const result = await command.execute({
      id: "dept-1",
      isActive: false,
    });

    expect(result.isActive).toBe(false);
  });

  it("有効な子部署がある場合は無効化できない", async () => {
    const department = createTestDepartment();
    const childDepartment = createTestDepartment("child-1");
    vi.mocked(mockRepository.findById).mockResolvedValue(department);
    vi.mocked(mockRepository.findChildren).mockResolvedValue([childDepartment]);

    await expect(
      command.execute({
        id: "dept-1",
        isActive: false,
      })
    ).rejects.toThrow(BusinessRuleViolationError);
    await expect(
      command.execute({
        id: "dept-1",
        isActive: false,
      })
    ).rejects.toThrow("有効な子部署が存在するため");
  });

  it("親部署を変更できる", async () => {
    const department = createTestDepartment();
    const newParent = Department.reconstruct(
      "parent-id",
      new DepartmentCd("DEPT002"),
      new DepartmentName("本社"),
      new Abbreviation("本社"),
      0,
      true,
      null,
      new Date(),
      new Date()
    );

    vi.mocked(mockRepository.findById)
      .mockResolvedValueOnce(department)
      .mockResolvedValueOnce(newParent);

    const result = await command.execute({
      id: "dept-1",
      parentId: "parent-id",
    });

    expect(result.parentId).toBe("parent-id");
  });

  it("循環参照になる親部署を設定するとエラー", async () => {
    // dept-1 が親で、dept-2 がその子の場合
    // dept-1 の親を dept-2 に変更しようとすると循環参照
    const department = createTestDepartment("dept-1");
    const childAsNewParent = Department.reconstruct(
      "dept-2",
      new DepartmentCd("DEPT002"),
      new DepartmentName("子部署"),
      new Abbreviation("子"),
      0,
      true,
      "dept-1", // dept-1 が親
      new Date(),
      new Date()
    );

    vi.mocked(mockRepository.findById).mockImplementation((id: string) => {
      if (id === "dept-1") return Promise.resolve(department);
      if (id === "dept-2") return Promise.resolve(childAsNewParent);
      return Promise.resolve(null);
    });

    await expect(
      command.execute({
        id: "dept-1",
        parentId: "dept-2",
      })
    ).rejects.toThrow(BusinessRuleViolationError);

    // reset mock for second assertion
    vi.mocked(mockRepository.findById).mockImplementation((id: string) => {
      if (id === "dept-1") return Promise.resolve(department);
      if (id === "dept-2") return Promise.resolve(childAsNewParent);
      return Promise.resolve(null);
    });

    await expect(
      command.execute({
        id: "dept-1",
        parentId: "dept-2",
      })
    ).rejects.toThrow("循環参照が発生するため");
  });
});
