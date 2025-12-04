import { Employee } from "@/subdomains/employee/entities/Employee";
import { IEmployeeRepository } from "@/subdomains/employee/repositories/IEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@/subdomains/employee/services/EmployeeCdDuplicationCheckDomainService";
import { MailAddressDuplicationCheckDomainService } from "@/shared/domain/services/MailAddressDuplicationCheckDomainService";
import { Role } from "@/subdomains/employee/types/Role";
import { EmployeeCd } from "@/subdomains/employee/values/EmployeeCd";
import { MailAddress } from "@/shared/domain/values/MailAddress";
import { ValidationError } from "@/shared/errors/DomainError";
import { CreateEmployeeCommand } from "@/subdomains/employee/commands/CreateEmployeeCommand";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("CreateEmployeeCommand", () => {
  let command: CreateEmployeeCommand;
  let mockRepository: IEmployeeRepository;
  let mockCdDuplicationCheckService: EmployeeCdDuplicationCheckDomainService;
  let mockMailDuplicationCheckService: MailAddressDuplicationCheckDomainService;

  beforeEach(() => {
    mockRepository = {
      save: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
      findByEmployeeCd: vi.fn(),
      findByEmail: vi.fn(),
    };

    mockCdDuplicationCheckService = {
      execute: vi.fn(),
    } as unknown as EmployeeCdDuplicationCheckDomainService;

    mockMailDuplicationCheckService = {
      execute: vi.fn(),
    } as unknown as MailAddressDuplicationCheckDomainService;

    command = new CreateEmployeeCommand(
      mockRepository,
      mockCdDuplicationCheckService,
      mockMailDuplicationCheckService
    );
  });

  it("従業員を新規登録できる", async () => {
    vi.mocked(mockCdDuplicationCheckService.execute).mockResolvedValue(false);
    vi.mocked(mockMailDuplicationCheckService.execute).mockResolvedValue(false);

    await command.execute({
      employeeCd: "EMP000001",
      email: "test@example.com",
      name: "テスト太郎",
      role: Role.USER,
    });

    expect(mockCdDuplicationCheckService.execute).toHaveBeenCalledWith(
      expect.any(EmployeeCd)
    );
    expect(mockMailDuplicationCheckService.execute).toHaveBeenCalledWith(
      expect.any(MailAddress)
    );
    expect(mockRepository.save).toHaveBeenCalledWith(expect.any(Employee));
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
  });

  it("既に存在する従業員CDの場合はエラーを投げる", async () => {
    vi.mocked(mockCdDuplicationCheckService.execute).mockResolvedValue(true);

    await expect(
      command.execute({
        employeeCd: "EMP000001",
        email: "test@example.com",
        name: "テスト太郎",
        role: Role.USER,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it("不正なメールアドレスの場合はエラーを投げる", async () => {
    vi.mocked(mockCdDuplicationCheckService.execute).mockResolvedValue(false);

    await expect(
      command.execute({
        employeeCd: "EMP000001",
        email: "invalid-email",
        name: "テスト太郎",
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
        role: Role.USER,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockCdDuplicationCheckService.execute).not.toHaveBeenCalled();
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
