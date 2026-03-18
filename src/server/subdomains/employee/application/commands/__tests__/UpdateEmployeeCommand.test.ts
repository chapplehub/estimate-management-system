import prisma from "@server/prisma";
import { FakeUserManagementService } from "@server/shared/auth/fake/FakeUserManagementService";
import { USER_ROLES } from "@server/shared/auth/types";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { ValidationError } from "@server/shared/errors/DomainError";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateEmployeeCommand } from "../UpdateEmployeeCommand";

describe("UpdateEmployeeCommand", () => {
  let command: UpdateEmployeeCommand;
  let repository: PrismaEmployeeRepository;
  let mailDuplicationCheckService: MailAddressDuplicationCheckDomainService;
  let fakeUserManagementService: FakeUserManagementService;

  const TEST_EMPLOYEE_ID = "test-update-id-001";
  const ANOTHER_EMPLOYEE_ID = "test-update-id-002";

  beforeEach(async () => {
    // 1. テストデータクリーンアップ
    await prisma.employee.deleteMany({
      where: {
        employeeCd: {
          in: ["EMP999912", "EMP999913"],
        },
      },
    });

    // 2. テスト用部署を upsert
    await prisma.department.upsert({
      where: { id: "dept-001" },
      update: {},
      create: {
        id: "dept-001",
        departmentCd: "DEPT001",
        name: "テスト部署",
        abbreviation: "テスト",
        isActive: true,
      },
    });

    // 3. 更新対象の既存従業員を作成
    await prisma.employee.create({
      data: {
        id: TEST_EMPLOYEE_ID,
        employeeCd: "EMP999912",
        email: "existing@example.com",
        name: "既存従業員",
        departmentId: "dept-001",
      },
    });

    // 4. 重複チェック用の別従業員を作成
    await prisma.employee.create({
      data: {
        id: ANOTHER_EMPLOYEE_ID,
        employeeCd: "EMP999913",
        email: "another@example.com",
        name: "別従業員",
        departmentId: "dept-001",
      },
    });

    // 5. 依存オブジェクト初期化
    repository = new PrismaEmployeeRepository();
    mailDuplicationCheckService = new MailAddressDuplicationCheckDomainService(repository);
    fakeUserManagementService = new FakeUserManagementService();

    // 6. 既存の認証ユーザーを登録
    await fakeUserManagementService.createUser({
      email: "existing@example.com",
      name: "既存従業員",
      password: "Password1!",
      employeeId: TEST_EMPLOYEE_ID,
      role: USER_ROLES.USER,
    });

    command = new UpdateEmployeeCommand(
      repository,
      mailDuplicationCheckService,
      fakeUserManagementService
    );
  });

  afterEach(async () => {
    await prisma.employee.deleteMany({
      where: {
        employeeCd: {
          in: ["EMP999912", "EMP999913"],
        },
      },
    });
    fakeUserManagementService.reset();
  });

  it("従業員情報を更新できる（email変更なし）", async () => {
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com", // 変更なし
      name: "更新後従業員",
      departmentId: "dept-001",
      role: USER_ROLES.USER,
    });

    // DBに反映されたことを確認
    const updated = await prisma.employee.findUnique({
      where: { id: TEST_EMPLOYEE_ID },
    });
    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("更新後従業員");
    expect(updated?.email).toBe("existing@example.com");
  });

  it("email変更時に認証ユーザーのemailも同期される", async () => {
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "newemail@example.com", // 変更
      name: "既存従業員",
      departmentId: "dept-001",
      role: USER_ROLES.USER,
    });

    // DBに反映されたことを確認
    const updated = await prisma.employee.findUnique({
      where: { id: TEST_EMPLOYEE_ID },
    });
    expect(updated?.email).toBe("newemail@example.com");

    // 認証ユーザーのemailも更新されたことを確認
    const authUser = fakeUserManagementService.getUser(TEST_EMPLOYEE_ID);
    expect(authUser?.email).toBe("newemail@example.com");
  });

  it("role変更時に認証ユーザーのroleも同期される", async () => {
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com",
      name: "既存従業員",
      departmentId: "dept-001",
      role: USER_ROLES.ADMIN, // USER -> ADMIN に変更
    });

    // 認証ユーザーのroleが更新されたことを確認
    const authUser = fakeUserManagementService.getUser(TEST_EMPLOYEE_ID);
    expect(authUser?.role).toBe(USER_ROLES.ADMIN);
  });

  it("存在しない従業員IDの場合はNotFoundEntityErrorがスローされる", async () => {
    await expect(
      command.execute({
        id: "non-existent-id-99999",
        employeeCd: "EMP999912",
        email: "existing@example.com",
        name: "更新テスト",
        departmentId: "dept-001",
        role: USER_ROLES.USER,
      })
    ).rejects.toThrow(NotFoundEntityError);
  });

  it("重複するメールアドレスの場合はエラー", async () => {
    await expect(
      command.execute({
        id: TEST_EMPLOYEE_ID,
        employeeCd: "EMP999912",
        email: "another@example.com", // 別従業員と同じemail
        name: "既存従業員",
        departmentId: "dept-001",
        role: USER_ROLES.USER,
      })
    ).rejects.toThrow(ValidationError);

    // 更新されていないことを確認
    const employee = await prisma.employee.findUnique({
      where: { id: TEST_EMPLOYEE_ID },
    });
    expect(employee?.email).toBe("existing@example.com");
  });
});
