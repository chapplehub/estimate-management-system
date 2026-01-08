import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { IEmployeeRepository } from "@subdomains/employee/domain/repositories/IEmployeeRepository";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { ValidationError } from "@server/shared/errors/DomainError";
import { UpdateEmployeeCommand } from "../UpdateEmployeeCommand";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IUserManagementService } from "@server/shared/auth/IUserManagementService";
import { USER_ROLES } from "@server/shared/auth/types";

describe("UpdateEmployeeCommand", () => {
  let command: UpdateEmployeeCommand;
  let mockRepository: IEmployeeRepository;
  let mockMailDuplicationCheckService: MailAddressDuplicationCheckDomainService;
  let mockUserManagementService: IUserManagementService;
  let existingEmployee: Employee;

  beforeEach(() => {
    existingEmployee = Employee.reconstruct(
      "test-id-001",
      new EmployeeCd("EMP000001"),
      new MailAddress("old@example.com"),
      new EmployeeName("旧名前"),
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

    mockUserManagementService = {
      createUser: vi.fn().mockResolvedValue({ success: true, userId: "user-1" }),
      updateUserEmail: vi.fn().mockResolvedValue({ success: true }),
      updateUserRole: vi.fn().mockResolvedValue({ success: true }),
      removeUser: vi.fn().mockResolvedValue({ success: true }),
      findUserByEmployeeId: vi.fn().mockResolvedValue({ id: "user-1" }),
    };

    command = new UpdateEmployeeCommand(
      mockRepository,
      mockMailDuplicationCheckService,
      mockUserManagementService
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
      role: USER_ROLES.ADMIN,
    });

    expect(mockRepository.findById).toHaveBeenCalledWith("test-id-001");
    expect(mockRepository.save).toHaveBeenCalledWith(existingEmployee);
    expect(mockRepository.save).toHaveBeenCalledTimes(1);

    // エンティティが更新されているか確認
    expect(existingEmployee.name.value).toBe("新名前");
    expect(existingEmployee.email.value).toBe("new@example.com");

    // email変更時に認証ユーザーのemailも更新されることを確認
    expect(mockUserManagementService.findUserByEmployeeId).toHaveBeenCalledWith(
      "test-id-001"
    );
    expect(mockUserManagementService.updateUserEmail).toHaveBeenCalledWith(
      "user-1",
      "new@example.com"
    );
    // role変更時に認証ユーザーのroleも更新されることを確認
    expect(mockUserManagementService.updateUserRole).toHaveBeenCalledWith(
      "user-1",
      USER_ROLES.ADMIN
    );
  });

  it("存在しない従業員IDの場合はエラーを投げる", async () => {
    vi.mocked(mockRepository.findById).mockResolvedValue(null);

    await expect(
      command.execute({
        id: "non-existent-id",
        employeeCd: "EMP000001",
        email: "test@example.com",
        name: "テスト太郎",
        role: USER_ROLES.USER,
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
        role: USER_ROLES.USER,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockRepository.save).not.toHaveBeenCalled();
  });
});
