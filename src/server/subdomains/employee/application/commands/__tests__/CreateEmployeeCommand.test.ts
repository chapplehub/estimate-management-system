import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import { FakeUserManagementService } from "@server/shared/auth/fake/FakeUserManagementService";
import { USER_ROLES } from "@server/shared/auth/types";
import { ValidationError } from "@server/shared/errors/DomainError";
import prisma from "@server/prisma";
import { EmployeeCdDuplicationCheckDomainService } from "@subdomains/employee/domain/services/EmployeeCdDuplicationCheckDomainService";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";
import { SuperiorRoleKachouTierValidationDomainService } from "@subdomains/role/domain/services/SuperiorRoleKachouTierValidationDomainService";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaPositionRepository } from "@subdomains/role/infrastructure/prisma/PrismaPositionRepository";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
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
  const TEST_ROLE_CDS = ["ROLE953", "ROLE959"];
  let TEST_DEPT_ID: string;
  let roleId: string; // 課長級（POS001）。担当役割／課員の上位役割の双方に使える
  let buchouRoleId: string; // 部長級（POS002）。課長級でない＝上位役割に不可

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

    // 担当役割 FK 用の役割を用意（POS001=課長・POS002=部長はシード済み）
    const [kachou, buchou] = await Promise.all([
      prisma.position.findUnique({ where: { positionCd: "POS001" } }),
      prisma.position.findUnique({ where: { positionCd: "POS002" } }),
    ]);
    roleId = generateId();
    buchouRoleId = generateId();
    await prisma.role.create({
      data: { id: roleId, roleCd: TEST_ROLE_CDS[0], name: "担当役割", positionId: kachou!.id },
    });
    await prisma.role.create({
      data: {
        id: buchouRoleId,
        roleCd: TEST_ROLE_CDS[1],
        name: "部長級役割",
        positionId: buchou!.id,
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
      fakeUserManagementService,
      new SuperiorRoleKachouTierValidationDomainService(
        new PrismaRoleRepository(),
        new PrismaPositionRepository()
      )
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

  it("課員に課長級の上位役割を指定して登録できる", async () => {
    await command.execute({
      employeeCd: TEST_CODES[0],
      email: "test-create-superior@example.com",
      name: "上位役割あり課員",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      password: "Password1!",
      superiorRoleId: roleId,
    });

    const saved = await repository.findByEmployeeCd(new EmployeeCd(TEST_CODES[0]));
    expect(saved?.assignedRoleId).toBeNull();
    expect(saved?.explicitSuperiorRoleId?.value).toBe(roleId);
  });

  it("課長級でない上位役割を指定するとエラー（登録されない）", async () => {
    await expect(
      command.execute({
        employeeCd: TEST_CODES[0],
        email: "test-create-nonkachou@example.com",
        name: "部長級上位役割課員",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        password: "Password1!",
        superiorRoleId: buchouRoleId,
      })
    ).rejects.toThrow(BusinessRuleViolationError);

    const saved = await repository.findByEmployeeCd(new EmployeeCd(TEST_CODES[0]));
    expect(saved).toBeNull();
  });

  it("担当役割と上位役割を同時指定すると上位役割は無視される（役割から導出）", async () => {
    await command.execute({
      employeeCd: TEST_CODES[0],
      email: "test-create-both@example.com",
      name: "役割と上位役割の両方指定",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      password: "Password1!",
      roleId,
      superiorRoleId: buchouRoleId,
    });

    const saved = await repository.findByEmployeeCd(new EmployeeCd(TEST_CODES[0]));
    expect(saved?.assignedRoleId?.value).toBe(roleId);
    expect(saved?.explicitSuperiorRoleId).toBeNull();
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
