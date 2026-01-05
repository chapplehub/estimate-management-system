import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { IEmployeeRepository } from "@subdomains/employee/domain/repositories/IEmployeeRepository";
import { EmployeeCdDuplicationCheckDomainService } from "@subdomains/employee/domain/services/EmployeeCdDuplicationCheckDomainService";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { ValidationError } from "@server/shared/errors/DomainError";
import { CreateEmployeeCommand } from "../CreateEmployeeCommand";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IUserManagementService } from "@server/shared/auth/IUserManagementService";

describe("CreateEmployeeCommand", () => {
  let command: CreateEmployeeCommand;
  let mockRepository: IEmployeeRepository;
  let mockCdDuplicationCheckService: EmployeeCdDuplicationCheckDomainService;
  let mockMailDuplicationCheckService: MailAddressDuplicationCheckDomainService;
  let mockUserManagementService: IUserManagementService;

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

    mockUserManagementService = {
      createUser: vi.fn().mockResolvedValue({ success: true, userId: "user-1" }),
      updateUserEmail: vi.fn().mockResolvedValue({ success: true }),
      updateUserRole: vi.fn().mockResolvedValue({ success: true }),
      removeUser: vi.fn().mockResolvedValue({ success: true }),
      findUserByEmployeeId: vi.fn().mockResolvedValue(null),
    };

    command = new CreateEmployeeCommand(
      mockRepository,
      mockCdDuplicationCheckService,
      mockMailDuplicationCheckService,
      mockUserManagementService
    );
  });

  it("従業員を新規登録できる", async () => {
    vi.mocked(mockCdDuplicationCheckService.execute).mockResolvedValue(false);
    vi.mocked(mockMailDuplicationCheckService.execute).mockResolvedValue(false);

    await command.execute({
      employeeCd: "EMP000001",
      email: "test@example.com",
      name: "テスト太郎",
      role: "user",
      password: "Password1!",
    });

    expect(mockCdDuplicationCheckService.execute).toHaveBeenCalledWith(
      expect.any(EmployeeCd)
    );
    expect(mockMailDuplicationCheckService.execute).toHaveBeenCalledWith(
      expect.any(MailAddress)
    );
    expect(mockRepository.save).toHaveBeenCalledWith(expect.any(Employee));
    expect(mockRepository.save).toHaveBeenCalledTimes(1);
    expect(mockUserManagementService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        password: "Password1!",
        name: "テスト太郎",
        role: "user",
      })
    );
  });

  it("既に存在する従業員CDの場合はエラーを投げる", async () => {
    vi.mocked(mockCdDuplicationCheckService.execute).mockResolvedValue(true);

    await expect(
      command.execute({
        employeeCd: "EMP000001",
        email: "test@example.com",
        name: "テスト太郎",
        role: "user",
        password: "Password1!",
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
        role: "user",
        password: "Password1!",
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
        role: "user",
        password: "Password1!",
      })
    ).rejects.toThrow(ValidationError);

    expect(mockCdDuplicationCheckService.execute).not.toHaveBeenCalled();
    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
