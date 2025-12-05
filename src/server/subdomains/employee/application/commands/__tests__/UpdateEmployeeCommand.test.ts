import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { IEmployeeRepository } from "@subdomains/employee/domain/repositories/IEmployeeRepository";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { Role } from "@subdomains/employee/domain/types/Role";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { ValidationError } from "@server/shared/errors/DomainError";
import { UpdateEmployeeCommand } from "../UpdateEmployeeCommand";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("UpdateEmployeeCommand", () => {
  let command: UpdateEmployeeCommand;
  let mockRepository: IEmployeeRepository;
  let mockMailDuplicationCheckService: MailAddressDuplicationCheckDomainService;
  let existingEmployee: Employee;

  beforeEach(() => {
    existingEmployee = Employee.reconstruct(
      "test-id-001",
      new EmployeeCd("EMP000001"),
      new MailAddress("old@example.com"),
      "旧名前",
      Role.USER,
      new Date("2025-01-01"),
      new Date("2025-01-01")
    );

    mockRepository = {
      save: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByEmployeeCd: vi.fn(),
      findByEmail: vi.fn(),
    };

    mockMailDuplicationCheckService = {
      execute: vi.fn(),
    } as unknown as MailAddressDuplicationCheckDomainService;

    command = new UpdateEmployeeCommand(
      mockRepository,
      mockMailDuplicationCheckService
    );
  });

  it("従業員情報を更新できる", async () => {
    vi.mocked(mockRepository.findById).mockResolvedValue(existingEmployee);
    vi.mocked(mockMailDuplicationCheckService.execute).mockResolvedValue(false);

    await command.execute({
      id: "test-id-001",
      employeeCd: "EMP000001",
      email: "new@example.com",
      name: "新名前",
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
        role: Role.USER,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
