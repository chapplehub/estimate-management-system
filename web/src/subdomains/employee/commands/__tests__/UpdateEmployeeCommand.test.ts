import { Employee } from "@/subdomains/employee/entities/Employee";
import { IEmployeeRepository } from "@/subdomains/employee/repositories/IEmployeeRepository";
import { Role } from "@/subdomains/employee/types/Role";
import { EmployeeCd } from "@/subdomains/employee/values/EmployeeCd";
import { MailAddress } from "@/shared/domain/values/MailAddress";
import { NotFoundEntityError } from "@/shared/errors/ApplicationError";
import { ValidationError } from "@/shared/errors/DomainError";
import { UpdateEmployeeCommand } from "@/subdomains/employee/commands/UpdateEmployeeCommand";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("UpdateEmployeeCommand", () => {
  let command: UpdateEmployeeCommand;
  let mockRepository: IEmployeeRepository;

  const existingEmployee = Employee.reconstruct(
    "test-id-001",
    new EmployeeCd("EMP000001"),
    new MailAddress("old@example.com"),
    "旧名前",
    "hashedPassword",
    Role.USER,
    0,
    null,
    null,
    new Date("2025-01-01"),
    new Date("2025-01-01")
  );

  beforeEach(() => {
    mockRepository = {
      save: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByEmployeeCd: vi.fn(),
      findByEmail: vi.fn(),
    };

    command = new UpdateEmployeeCommand(mockRepository);
  });

  it("従業員情報を更新できる", async () => {
    vi.mocked(mockRepository.findById).mockResolvedValue(existingEmployee);

    await command.execute({
      id: "test-id-001",
      employeeCd: "EMP000001",
      email: "new@example.com",
      name: "新名前",
      passwordHash: "newHashedPassword",
      role: Role.ADMIN,
    });

    expect(mockRepository.findById).toHaveBeenCalledWith("test-id-001");
    expect(mockRepository.save).toHaveBeenCalledWith(existingEmployee);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);

    // エンティティが更新されているか確認
    expect(existingEmployee.name).toBe("新名前");
    expect(existingEmployee.email.value).toBe("new@example.com");
    expect(existingEmployee.role).toBe(Role.ADMIN);
  });

  it("存在しない従業員IDの場合はエラーを投げる", async () => {
    vi.mocked(mockRepository.findById).mockResolvedValue(null);

    await expect(
      command.execute({
        id: "non-existent-id",
        employeeCd: "EMP000001",
        email: "test@example.com",
        name: "テスト太郎",
        passwordHash: "hashedPassword",
        role: Role.USER,
      })
    ).rejects.toThrow(NotFoundEntityError);

    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it("不正なメールアドレスの場合はエラーを投げる", async () => {
    vi.mocked(mockRepository.findById).mockResolvedValue(existingEmployee);

    await expect(
      command.execute({
        id: "test-id-001",
        employeeCd: "EMP000001",
        email: "invalid-email",
        name: "新名前",
        passwordHash: "hashedPassword",
        role: Role.USER,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
