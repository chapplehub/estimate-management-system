import { Employee } from "@/domain/entities/Employee";
import { IEmployeeRepository } from "@/domain/repositories/IEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@/domain/services/employee/EmployeeCdDuplicationCheckDomainService";
import { Role } from "@/domain/types/Role";
import { EmployeeCd } from "@/domain/value/EmployeeCd";
import { MailAddress } from "@/domain/value/MailAddress";
import { ValidationError } from "@/shared/errors/DomainError";
import { CreateEmployeeCommand } from "@/application/Employee/commands/CreateEmployeeCommand";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("CreateEmployeeCommand", () => {
  let command: CreateEmployeeCommand;
  let mockRepository: IEmployeeRepository;
  let mockDuplicationCheckService: EmployeeCdDuplicationCheckDomainService;

  beforeEach(() => {
    mockRepository = {
      save: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByEmployeeCd: vi.fn(),
      findByEmail: vi.fn(),
    };

    mockDuplicationCheckService = {
      execute: vi.fn(),
    } as unknown as EmployeeCdDuplicationCheckDomainService;

    command = new CreateEmployeeCommand(
      mockRepository,
      mockDuplicationCheckService
    );
  });

  it("従業員を新規登録できる", async () => {
    vi.mocked(mockDuplicationCheckService.execute).mockResolvedValue(false);

    await command.execute({
      employeeCd: "EMP000001",
      email: "test@example.com",
      name: "テスト太郎",
      passwordHash: "hashedPassword123",
      role: Role.USER,
    });

    expect(mockDuplicationCheckService.execute).toHaveBeenCalledWith(
      expect.any(EmployeeCd)
    );
    expect(mockRepository.save).toHaveBeenCalledWith(expect.any(Employee));
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it("既に存在する従業員CDの場合はエラーを投げる", async () => {
    vi.mocked(mockDuplicationCheckService.execute).mockResolvedValue(true);

    await expect(
      command.execute({
        employeeCd: "EMP000001",
        email: "test@example.com",
        name: "テスト太郎",
        passwordHash: "hashedPassword123",
        role: Role.USER,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it("不正なメールアドレスの場合はエラーを投げる", async () => {
    vi.mocked(mockDuplicationCheckService.execute).mockResolvedValue(false);

    await expect(
      command.execute({
        employeeCd: "EMP000001",
        email: "invalid-email",
        name: "テスト太郎",
        passwordHash: "hashedPassword123",
        role: Role.USER,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it("不正な従業員CDの場合はエラーを投げる", async () => {
    await expect(
      command.execute({
        employeeCd: "INVALID",
        email: "test@example.com",
        name: "テスト太郎",
        passwordHash: "hashedPassword123",
        role: Role.USER,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockDuplicationCheckService.execute).not.toHaveBeenCalled();
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
