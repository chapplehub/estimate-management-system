import { createId } from "@paralleldrive/cuid2";
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

  const TEST_CODES = ["EMP999911", "EMP999914"];
  let TEST_DEPT_ID: string;

  beforeEach(async () => {
    await prisma.employee.deleteMany({
      where: { employeeCd: { in: TEST_CODES } },
    });

    const dept = await prisma.department.upsert({
      where: { departmentCd: "TEST_DEPT" },
      update: {},
      create: {
        id: createId(),
        departmentCd: "TEST_DEPT",
        name: "テスト部署",
        abbreviation: "テスト",
        isActive: true,
      },
    });
    TEST_DEPT_ID = dept.id;

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
    await prisma.employee.deleteMany({
      where: { employeeCd: { in: TEST_CODES } },
    });
  });

  it("従業員を新規登録できる", async () => {
    await command.execute({
      employeeCd: TEST_CODES[0],
      email: "test-create-cmd@example.com",
      name: "テスト太郎",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      password: "Password1!",
    });

    const saved = await repository.findByEmployeeCd(new EmployeeCd(TEST_CODES[0]));
    expect(saved).not.toBeNull();
    expect(saved?.email.value).toBe("test-create-cmd@example.com");
    expect(saved?.name.value).toBe("テスト太郎");
    expect(saved?.departmentId).toBe(TEST_DEPT_ID);
  });

  it("社員コードが重複している場合はエラー", async () => {
    await command.execute({
      employeeCd: TEST_CODES[0],
      email: "test-create-dup-cd-1@example.com",
      name: "重複CD元",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      password: "Password1!",
    });

    await expect(
      command.execute({
        employeeCd: TEST_CODES[0],
        email: "test-create-dup-cd-2@example.com",
        name: "重複CD先",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        password: "Password1!",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("メールアドレスが重複している場合はエラー", async () => {
    await command.execute({
      employeeCd: TEST_CODES[0],
      email: "test-create-dup-email@example.com",
      name: "重複Email元",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      password: "Password1!",
    });

    await expect(
      command.execute({
        employeeCd: TEST_CODES[1],
        email: "test-create-dup-email@example.com",
        name: "重複Email先",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        password: "Password1!",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("認証ユーザー作成失敗時、保存したEmployeeが削除される", async () => {
    fakeUserManagementService.setCreateUserToFail(true);

    await expect(
      command.execute({
        employeeCd: TEST_CODES[0],
        email: "test-create-cmd@example.com",
        name: "テスト太郎",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        password: "Password1!",
      })
    ).rejects.toThrow(ValidationError);

    const employee = await repository.findByEmployeeCd(new EmployeeCd(TEST_CODES[0]));
    expect(employee).toBeNull();
  });
});
