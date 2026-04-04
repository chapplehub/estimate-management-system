import { generateId } from "@server/shared/generateId";
import prisma from "@server/prisma";
import { FakeUserManagementService } from "@server/shared/auth/fake/FakeUserManagementService";
import { USER_ROLES } from "@server/shared/auth/types";
import { NotFoundEntityError } from "@server/shared/errors/ApplicationError";
import { PrismaEmployeeRepository } from "@subdomains/employee/infrastructure/prisma/PrismaEmployeeRepository";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DeleteEmployeeCommand } from "../DeleteEmployeeCommand";

describe("DeleteEmployeeCommand", () => {
  let command: DeleteEmployeeCommand;
  let repository: PrismaEmployeeRepository;
  let fakeUserManagementService: FakeUserManagementService;

  const TEST_EMPLOYEE_ID = "test-delete-cmd-id-001";
  const TEST_EMPLOYEE_CD = "EMP999909";
  let TEST_DEPT_ID: string;

  beforeEach(async () => {
    // テストデータのクリーンアップ
    await prisma.employee.deleteMany({
      where: {
        employeeCd: TEST_EMPLOYEE_CD,
      },
    });

    // テスト用部署を作成（存在しない場合）
    const dept = await prisma.department.upsert({
      where: { departmentCd: "TEST_DEPT" },
      update: {},
      create: {
        id: generateId(),
        departmentCd: "TEST_DEPT",
        name: "テスト部署",
        abbreviation: "テスト",
        isActive: true,
      },
    });
    TEST_DEPT_ID = dept.id;

    repository = new PrismaEmployeeRepository();
    fakeUserManagementService = new FakeUserManagementService();

    command = new DeleteEmployeeCommand(repository, fakeUserManagementService);
  });

  afterEach(async () => {
    // テストデータのクリーンアップ
    await prisma.employee.deleteMany({
      where: {
        employeeCd: TEST_EMPLOYEE_CD,
      },
    });
    fakeUserManagementService.reset();
  });

  /**
   * テスト用の従業員を作成するヘルパー
   */
  async function createTestEmployee(): Promise<void> {
    await prisma.employee.create({
      data: {
        id: TEST_EMPLOYEE_ID,
        employeeCd: TEST_EMPLOYEE_CD,
        email: "delete-cmd-test@example.com",
        name: "削除テスト太郎",
        departmentId: TEST_DEPT_ID,
      },
    });
  }

  /**
   * テスト用の認証ユーザーを作成するヘルパー
   */
  async function createTestAuthUser(): Promise<void> {
    await fakeUserManagementService.createUser({
      email: "delete-cmd-test@example.com",
      name: "削除テスト太郎",
      employeeId: TEST_EMPLOYEE_ID,
      role: USER_ROLES.USER,
      password: "Password1!",
    });
  }

  it("認証ユーザーが存在する従業員を削除できる", async () => {
    // 準備：従業員と認証ユーザーを作成
    await createTestEmployee();
    await createTestAuthUser();

    // 実行：削除コマンドを実行
    await command.execute({ id: TEST_EMPLOYEE_ID });

    // 検証：従業員がDBから削除されていること
    const employee = await prisma.employee.findUnique({
      where: { id: TEST_EMPLOYEE_ID },
    });
    expect(employee).toBeNull();

    // 検証：認証ユーザーも削除されていること
    const authUser = await fakeUserManagementService.findUserByEmployeeId(TEST_EMPLOYEE_ID);
    expect(authUser).toBeNull();
  });

  it("認証ユーザーが存在しない従業員を削除できる", async () => {
    // 準備：従業員のみ作成（認証ユーザーなし）
    await createTestEmployee();

    // 実行：削除コマンドを実行
    await command.execute({ id: TEST_EMPLOYEE_ID });

    // 検証：従業員がDBから削除されていること
    const employee = await prisma.employee.findUnique({
      where: { id: TEST_EMPLOYEE_ID },
    });
    expect(employee).toBeNull();
  });

  it("存在しない従業員を削除しようとするとNotFoundEntityErrorがスローされる", async () => {
    const nonExistentId = "non-existent-id-12345";

    await expect(command.execute({ id: nonExistentId })).rejects.toThrow(NotFoundEntityError);
  });

  it("認証ユーザー削除失敗時はエラーがスローされる", async () => {
    // 準備：従業員と認証ユーザーを作成
    await createTestEmployee();
    await createTestAuthUser();

    // 準備：認証ユーザー削除を失敗させる
    fakeUserManagementService.setRemoveUserToFail(true);

    // 実行・検証：エラーがスローされること
    await expect(command.execute({ id: TEST_EMPLOYEE_ID })).rejects.toThrow(Error);

    // 検証：従業員が削除されていないこと（エラーで処理が中断されたため）
    const employee = await prisma.employee.findUnique({
      where: { id: TEST_EMPLOYEE_ID },
    });
    expect(employee).not.toBeNull();

    // 検証：認証ユーザーも削除されていないこと
    const authUser = await fakeUserManagementService.findUserByEmployeeId(TEST_EMPLOYEE_ID);
    expect(authUser).not.toBeNull();
  });
});
