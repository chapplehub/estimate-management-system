import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import prisma from "@server/prisma";
import { FakeUserManagementService } from "@server/shared/auth/fake/FakeUserManagementService";
import { USER_ROLES } from "@server/shared/auth/types";
import { ConflictError, NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { ValidationError } from "@server/shared/errors/DomainError";
import { MailAddressDuplicationCheckDomainService } from "@subdomains/employee/domain/services/MailAddressDuplicationCheckDomainService";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";
import { SuperiorRoleKachouTierValidationDomainService } from "@subdomains/role/domain/services/SuperiorRoleKachouTierValidationDomainService";
import { PrismaRoleRepository } from "@subdomains/role/infrastructure/prisma/PrismaRoleRepository";
import { PrismaPositionRepository } from "@subdomains/role/infrastructure/prisma/PrismaPositionRepository";
import { BusinessRuleViolationError } from "@server/shared/errors/DomainError";
import { generateId } from "@server/shared/generateId";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateEmployeeCommand } from "../UpdateEmployeeCommand";

describe("UpdateEmployeeCommand", () => {
  let command: UpdateEmployeeCommand;
  let repository: PrismaEmployeeRepository;
  let mailDuplicationCheckService: MailAddressDuplicationCheckDomainService;
  let fakeUserManagementService: FakeUserManagementService;

  const TEST_EMPLOYEE_ID = "00000000-0000-7000-8000-100000000001";
  const ANOTHER_EMPLOYEE_ID = "00000000-0000-7000-8000-100000000002";
  const TEST_EMP_CDS = ["EMP999912", "EMP999913"];
  const TEST_ROLE_CDS = ["ROLE954", "ROLE955", "ROLE960"];
  let TEST_DEPT_ID: string;
  let roleAId: string; // 課長級（POS001）
  let roleBId: string; // 課長級（POS001）
  let buchouRoleId: string; // 部長級（POS002）。課長級でない＝上位役割に不可

  async function cleanupRolesAndChildren() {
    await prisma.employeeRole.deleteMany({
      where: { employee: { employeeCd: { in: TEST_EMP_CDS } } },
    });
    await prisma.employee.deleteMany({ where: { employeeCd: { in: TEST_EMP_CDS } } });
    await prisma.role.deleteMany({ where: { roleCd: { in: TEST_ROLE_CDS } } });
  }

  beforeEach(async () => {
    // 1. テストデータクリーンアップ（子行→従業員→役割）
    await cleanupRolesAndChildren();

    // 2. テスト用部署を確保
    TEST_DEPT_ID = await ensureTestDepartment();

    // 2-1. 担当役割 FK 用の役割を用意（POS001=課長・POS002=部長はシード済み）
    const [kachou, buchou] = await Promise.all([
      prisma.position.findUnique({ where: { positionCd: "POS001" } }),
      prisma.position.findUnique({ where: { positionCd: "POS002" } }),
    ]);
    roleAId = generateId();
    roleBId = generateId();
    buchouRoleId = generateId();
    await prisma.role.createMany({
      data: [
        { id: roleAId, roleCd: TEST_ROLE_CDS[0], name: "担当役割A", positionId: kachou!.id },
        { id: roleBId, roleCd: TEST_ROLE_CDS[1], name: "担当役割B", positionId: kachou!.id },
        { id: buchouRoleId, roleCd: TEST_ROLE_CDS[2], name: "部長級役割", positionId: buchou!.id },
      ],
    });

    // 3. 更新対象の既存従業員を作成
    await prisma.employee.create({
      data: {
        id: TEST_EMPLOYEE_ID,
        employeeCd: "EMP999912",
        email: "existing@example.com",
        name: "既存従業員",
        departmentId: TEST_DEPT_ID,
      },
    });

    // 4. 重複チェック用の別従業員を作成
    await prisma.employee.create({
      data: {
        id: ANOTHER_EMPLOYEE_ID,
        employeeCd: "EMP999913",
        email: "another@example.com",
        name: "別従業員",
        departmentId: TEST_DEPT_ID,
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
      fakeUserManagementService,
      new SuperiorRoleKachouTierValidationDomainService(
        new PrismaRoleRepository(),
        new PrismaPositionRepository()
      )
    );
  });

  afterEach(async () => {
    await cleanupRolesAndChildren();
    fakeUserManagementService.reset();
  });

  it("従業員情報を更新できる（email変更なし）", async () => {
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com", // 変更なし
      name: "更新後従業員",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 1,
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
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 1,
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
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.ADMIN, // USER -> ADMIN に変更
      expectedVersion: 1,
    });

    // 認証ユーザーのroleが更新されたことを確認
    const authUser = fakeUserManagementService.getUser(TEST_EMPLOYEE_ID);
    expect(authUser?.role).toBe(USER_ROLES.ADMIN);
  });

  it("stale な expectedVersion では ConflictError になり、認証ユーザーへの同期も行われない", async () => {
    // 別ユーザーが先に保存して version が進んだ状況（1 → 2）を再現
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com",
      name: "先行ユーザーの変更",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 1,
    });

    // 古い編集画面（version 1）からの保存 → 競合
    await expect(
      command.execute({
        id: TEST_EMPLOYEE_ID,
        employeeCd: "EMP999912",
        email: "stale@example.com",
        name: "後追いユーザーの変更",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.ADMIN,
        expectedVersion: 1,
      })
    ).rejects.toThrow(ConflictError);

    // employee は先行ユーザーの変更のまま（lost update が起きていない）
    const employee = await prisma.employee.findUnique({
      where: { id: TEST_EMPLOYEE_ID },
    });
    expect(employee?.name).toBe("先行ユーザーの変更");
    expect(employee?.email).toBe("existing@example.com");

    // 認証ユーザーへの同期（email/role）にも到達していない。
    // employee 行の条件付き UPDATE が User 同期より先に走る順序が、この保護の前提（#317）
    const authUser = fakeUserManagementService.getUser(TEST_EMPLOYEE_ID);
    expect(authUser?.email).toBe("existing@example.com");
    expect(authUser?.role).toBe(USER_ROLES.USER);
  });

  it("存在しない従業員IDの場合はNotFoundEntityErrorがスローされる", async () => {
    await expect(
      command.execute({
        id: "00000000-0000-7000-8000-000000000003",
        employeeCd: "EMP999912",
        email: "existing@example.com",
        name: "更新テスト",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        expectedVersion: 1,
      })
    ).rejects.toThrow(NotFoundEntityError);
    await expect(
      command.execute({
        id: "00000000-0000-7000-8000-000000000003",
        employeeCd: "EMP999912",
        email: "existing@example.com",
        name: "更新テスト",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        expectedVersion: 1,
      })
    ).rejects.toThrow("従業員が見つかりません");
  });

  it("重複するメールアドレスの場合はエラー", async () => {
    await expect(
      command.execute({
        id: TEST_EMPLOYEE_ID,
        employeeCd: "EMP999912",
        email: "another@example.com", // 別従業員と同じemail
        name: "既存従業員",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        expectedVersion: 1,
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      command.execute({
        id: TEST_EMPLOYEE_ID,
        employeeCd: "EMP999912",
        email: "another@example.com",
        name: "既存従業員",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        expectedVersion: 1,
      })
    ).rejects.toThrow("既に存在するメールアドレスです");

    // 更新されていないことを確認
    const employee = await prisma.employee.findUnique({
      where: { id: TEST_EMPLOYEE_ID },
    });
    expect(employee?.email).toBe("existing@example.com");
  });

  it("担当役割を割り当て、別の役割へ置換できる", async () => {
    // roleA を割り当て（version 1 → 2）
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com",
      name: "既存従業員",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 1,
      roleId: roleAId,
    });

    const afterAssign = await repository.findById(new EmployeeId(TEST_EMPLOYEE_ID));
    expect(afterAssign?.assignedRoleId?.value).toBe(roleAId);

    // roleB へ置換（version 2 → 3）
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com",
      name: "既存従業員",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 2,
      roleId: roleBId,
    });

    const afterReplace = await repository.findById(new EmployeeId(TEST_EMPLOYEE_ID));
    expect(afterReplace?.assignedRoleId?.value).toBe(roleBId);
  });

  it("担当役割を省略して更新すると役割なし（解除）になる", async () => {
    // まず roleA を割り当て
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com",
      name: "既存従業員",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 1,
      roleId: roleAId,
    });

    // roleId 省略で更新 → 解除（次の状態で上書き）
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com",
      name: "既存従業員",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 2,
    });

    const afterClear = await repository.findById(new EmployeeId(TEST_EMPLOYEE_ID));
    expect(afterClear?.assignedRoleId).toBeNull();
  });

  it("課員に課長級の上位役割を設定でき、省略で解除される", async () => {
    // 課員（役割なし）に上位役割 roleA（課長級）を設定
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com",
      name: "既存従業員",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 1,
      superiorRoleId: roleAId,
    });

    const afterSet = await repository.findById(new EmployeeId(TEST_EMPLOYEE_ID));
    expect(afterSet?.assignedRoleId).toBeNull();
    expect(afterSet?.explicitSuperiorRoleId?.value).toBe(roleAId);

    // superiorRoleId 省略で更新 → 解除
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com",
      name: "既存従業員",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 2,
    });

    const afterClear = await repository.findById(new EmployeeId(TEST_EMPLOYEE_ID));
    expect(afterClear?.explicitSuperiorRoleId).toBeNull();
  });

  it("課長級でない上位役割を指定するとエラー（更新されない）", async () => {
    await expect(
      command.execute({
        id: TEST_EMPLOYEE_ID,
        employeeCd: "EMP999912",
        email: "existing@example.com",
        name: "部長級上位役割",
        departmentId: TEST_DEPT_ID,
        role: USER_ROLES.USER,
        expectedVersion: 1,
        superiorRoleId: buchouRoleId,
      })
    ).rejects.toThrow(BusinessRuleViolationError);

    // 検証は永続化より前に走るため、名前も version も変わっていない
    const employee = await repository.findById(new EmployeeId(TEST_EMPLOYEE_ID));
    expect(employee?.name.value).toBe("既存従業員");
    expect(employee?.explicitSuperiorRoleId).toBeNull();
  });

  it("担当役割を割り当てると明示上位役割は自動的に解除される（I1）", async () => {
    // まず課員に上位役割を設定
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com",
      name: "既存従業員",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 1,
      superiorRoleId: roleAId,
    });

    // 担当役割 roleB を割り当て（superiorRoleId は同時指定しても無視される）
    await command.execute({
      id: TEST_EMPLOYEE_ID,
      employeeCd: "EMP999912",
      email: "existing@example.com",
      name: "既存従業員",
      departmentId: TEST_DEPT_ID,
      role: USER_ROLES.USER,
      expectedVersion: 2,
      roleId: roleBId,
      superiorRoleId: roleAId,
    });

    const after = await repository.findById(new EmployeeId(TEST_EMPLOYEE_ID));
    expect(after?.assignedRoleId?.value).toBe(roleBId);
    expect(after?.explicitSuperiorRoleId).toBeNull();
  });
});
