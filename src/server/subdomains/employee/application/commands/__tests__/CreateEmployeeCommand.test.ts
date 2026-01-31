import { FakeUserManagementService } from "@server/shared/auth/fake/FakeUserManagementService";
import { USER_ROLES } from "@server/shared/auth/types";
import { ValidationError } from "@server/shared/errors/DomainError";
import prisma from "@server/prisma";
import { EmployeeCdDuplicationCheckDomainService } from "@subdomains/employee/domain/services/EmployeeCdDuplicationCheckDomainService";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreateEmployeeCommand } from "../CreateEmployeeCommand";

describe("CreateEmployeeCommand", () => {
  let command: CreateEmployeeCommand;
  let repository: PrismaEmployeeRepository;
  let cdDuplicationCheckService: EmployeeCdDuplicationCheckDomainService;
  let mailDuplicationCheckService: MailAddressDuplicationCheckDomainService;
  let fakeUserManagementService: FakeUserManagementService;

  beforeEach(async () => {
    // テストデータのクリーンアップ
    await prisma.employee.deleteMany({
      where: {
        employeeCd: {
          in: ["EMP999911"],
        },
      },
    });

    // テスト用部署を作成（存在しない場合）
    await prisma.department.upsert({
      where: { id: "dept-001" },
      update: {},
      create: {
        id: "dept-001",
        departmentCd: "DEPT001",
        name: "テスト部署",
        abbreviation: "テスト",
        displayOrder: 1,
        isActive: true,
      },
    });

    repository = new PrismaEmployeeRepository();
    cdDuplicationCheckService = new EmployeeCdDuplicationCheckDomainService(repository);
    mailDuplicationCheckService = new MailAddressDuplicationCheckDomainService(repository);
    fakeUserManagementService = new FakeUserManagementService();

    command = new CreateEmployeeCommand(
      repository,
      cdDuplicationCheckService,
      mailDuplicationCheckService,
      fakeUserManagementService
    );
  });

  afterEach(async () => {
    // テストデータのクリーンアップ
    await prisma.employee.deleteMany({
      where: {
        employeeCd: {
          in: ["EMP999911"],
        },
      },
    });
  });

  it("従業員を新規登録できる", async () => {
    await command.execute({
      employeeCd: "EMP999911",
      email: "test-create-cmd@example.com",
      name: "テスト太郎",
      departmentId: "dept-001",
      role: USER_ROLES.USER,
      password: "Password1!",
    });

    // 実際にリポジトリに保存されたことを確認
    const saved = await repository.findByEmployeeCd(new EmployeeCd("EMP999911"));
    expect(saved).not.toBeNull();
    expect(saved?.email.value).toBe("test-create-cmd@example.com");
    expect(saved?.name.value).toBe("テスト太郎");
    expect(saved?.departmentId).toBe("dept-001");
  });

  it("認証ユーザー作成失敗時、保存したEmployeeが削除される", async () => {
    fakeUserManagementService.setCreateUserToFail(true);

    await expect(
      command.execute({
        employeeCd: "EMP999911",
        email: "test-create-cmd@example.com",
        name: "テスト太郎",
        departmentId: "dept-001",
        role: USER_ROLES.USER,
        password: "Password1!",
      })
    ).rejects.toThrow(ValidationError);

    // ロールバックされてEmployeeが残っていないことを確認
    const employee = await repository.findByEmployeeCd(new EmployeeCd("EMP999911"));
    expect(employee).toBeNull();
  });
});
