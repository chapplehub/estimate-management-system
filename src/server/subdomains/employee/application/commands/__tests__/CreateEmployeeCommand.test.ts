import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import { FakeUserManagementService } from "@server/shared/auth/fake/FakeUserManagementService";
import { USER_ROLES } from "@server/shared/auth/types";
import { ValidationError } from "@server/shared/errors/DomainError";
import prisma from "@server/prisma";
import { EmployeeCdDuplicationCheckDomainService } from "@subdomains/employee/domain/services/EmployeeCdDuplicationCheckDomainService";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";
import { generateId } from "@server/shared/generateId";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CreateEmployeeCommand } from "../CreateEmployeeCommand";

describe("CreateEmployeeCommand", () => {
  let command: CreateEmployeeCommand;
  let repository: PrismaEmployeeRepository;
  let cdDuplicationCheckService: EmployeeCdDuplicationCheckDomainService;
  let mailDuplicationCheckService: MailAddressDuplicationCheckDomainService;
  let fakeUserManagementService: FakeUserManagementService;

  const TEST_CODES = ["EMP999911", "EMP999914"];
  const TEST_ROLE_CDS = ["ROLE953"];
  let TEST_DEPT_ID: string;
  let roleId: string;

  async function cleanup() {
    await prisma.employeeRole.deleteMany({
      where: { employee: { employeeCd: { in: TEST_CODES } } },
    });
    await prisma.employee.deleteMany({ where: { employeeCd: { in: TEST_CODES } } });
    await prisma.role.deleteMany({ where: { roleCd: { in: TEST_ROLE_CDS } } });
  }

  beforeEach(async () => {
    await cleanup();

    TEST_DEPT_ID = await ensureTestDepartment();

    // 担当役割 FK 用の役割を用意（POS001=課長はシード済み）
    const kachou = await prisma.position.findUnique({ where: { positionCd: "POS001" } });
    roleId = generateId();
    await prisma.role.create({
      data: { id: roleId, roleCd: TEST_ROLE_CDS[0], name: "担当役割", positionId: kachou!.id },
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

  afterEach(cleanup);

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
    expect(saved?.departmentId.value).toBe(TEST_DEPT_ID);
  });

  it("担当役割を指定して新規登録できる", async () => {
    await command.execute({
      employeeCd: TEST_CODES[0],
      email: "test-create-role@example.com",
      name: "役割あり太郎",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      password: "Password1!",
      roleId,
    });

    const saved = await repository.findByEmployeeCd(new EmployeeCd(TEST_CODES[0]));
    expect(saved?.assignedRoleId?.value).toBe(roleId);
  });

  it("担当役割を省略すると役割なし（課員）で登録される", async () => {
    await command.execute({
      employeeCd: TEST_CODES[0],
      email: "test-create-norole@example.com",
      name: "役割なし太郎",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      password: "Password1!",
    });

    const saved = await repository.findByEmployeeCd(new EmployeeCd(TEST_CODES[0]));
    expect(saved?.assignedRoleId).toBeNull();
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
    await expect(
      command.execute({
        employeeCd: TEST_CODES[0],
        email: "test-create-dup-cd-2@example.com",
        name: "重複CD先",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        password: "Password1!",
      })
    ).rejects.toThrow("既に存在する従業員CDです");
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
    await expect(
      command.execute({
        employeeCd: TEST_CODES[1],
        email: "test-create-dup-email@example.com",
        name: "重複Email先",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        password: "Password1!",
      })
    ).rejects.toThrow("既に存在するメールアドレスです");
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
    await expect(
      command.execute({
        employeeCd: TEST_CODES[0],
        email: "test-create-cmd@example.com",
        name: "テスト太郎",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        password: "Password1!",
      })
    ).rejects.toThrow("認証ユーザーの作成に失敗しました");

    const employee = await repository.findByEmployeeCd(new EmployeeCd(TEST_CODES[0]));
    expect(employee).toBeNull();
  });
});
