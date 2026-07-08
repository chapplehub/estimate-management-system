import { ensureTestDepartment } from "@server/__tests__/helpers/ensureTestDepartment";
import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { RoleId } from "@subdomains/role/domain/values/RoleId";
import { PrismaEmployeeRepository } from "../PrismaEmployeeRepository";
import prisma from "@server/prisma";
import { generateId } from "@server/shared/generateId";
import { ConflictError } from "@server/shared/errors/ApplicationError";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("PrismaEmployeeRepository", () => {
  // ファイル別プレフィックスで並列実行の P2002 を避ける（#327）。roleCd は VarChar(7)。
  const TEST_EMP_CDS = ["EMP999001", "EMP999002", "EMP999003"];
  const TEST_ROLE_CDS = ["ROLE951", "ROLE952"];

  let repository: PrismaEmployeeRepository;
  let TEST_DEPT_ID: DepartmentId;
  let roleAId: string;
  let roleBId: string;

  async function cleanup() {
    // 子行（employeeRole / employeeSuperiorRole）→ 従業員 → 役割 の順で
    // FK 制約を満たしながら削除する（従業員削除でも CASCADE されるが明示的に）。
    await prisma.employeeRole.deleteMany({
      where: { employee: { employeeCd: { in: TEST_EMP_CDS } } },
    });
    await prisma.employeeSuperiorRole.deleteMany({
      where: { employee: { employeeCd: { in: TEST_EMP_CDS } } },
    });
    await prisma.employee.deleteMany({ where: { employeeCd: { in: TEST_EMP_CDS } } });
    await prisma.role.deleteMany({ where: { roleCd: { in: TEST_ROLE_CDS } } });
  }

  beforeEach(async () => {
    repository = new PrismaEmployeeRepository();
    await cleanup();

    // テスト用部署を確保
    TEST_DEPT_ID = new DepartmentId(await ensureTestDepartment());

    // 担当役割テスト用の役割を用意（FK 参照先。POS001=課長はシード済み）
    const kachou = await prisma.position.findUnique({ where: { positionCd: "POS001" } });
    roleAId = generateId();
    roleBId = generateId();
    await prisma.role.createMany({
      data: [
        { id: roleAId, roleCd: TEST_ROLE_CDS[0], name: "担当役割A", positionId: kachou!.id },
        { id: roleBId, roleCd: TEST_ROLE_CDS[1], name: "担当役割B", positionId: kachou!.id },
      ],
    });
  });

  afterEach(cleanup);

  describe("insert", () => {
    it("新規従業員を保存でき、version は 1 で始まる", async () => {
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("test-save@example.com"),
        new EmployeeName("テスト太郎"),
        TEST_DEPT_ID
      );

      const savedEmployee = await repository.insert(employee);

      // 保存されたエンティティを確認
      expect(savedEmployee).not.toBeNull();
      expect(savedEmployee.id.value).toBeTruthy();
      expect(savedEmployee.employeeCd.value).toBe("EMP999001");
      expect(savedEmployee.email.value).toBe("test-save@example.com");
      expect(savedEmployee.name.value).toBe("テスト太郎");

      // DBから取得して確認（version 列は @default(1)）
      const saved = await prisma.employee.findUnique({
        where: { employeeCd: "EMP999001" },
      });

      expect(saved).not.toBeNull();
      expect(saved?.employeeCd).toBe("EMP999001");
      expect(saved?.email).toBe("test-save@example.com");
      expect(saved?.name).toBe("テスト太郎");
      expect(saved?.version).toBe(1);
    });
  });

  describe("update", () => {
    it("一致する expectedVersion で更新でき、version が 1 進む", async () => {
      // まず保存
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("test-update@example.com"),
        new EmployeeName("更新前の名前"),
        TEST_DEPT_ID
      );
      const savedEmployee = await repository.insert(employee);

      // 名前を変更
      savedEmployee.changeName(new EmployeeName("更新後の名前"));
      const updatedEmployee = await repository.update(savedEmployee, 1);

      // 更新されたエンティティを確認
      expect(updatedEmployee.name.value).toBe("更新後の名前");
      expect(updatedEmployee.id.value).toBe(savedEmployee.id.value);

      // DBから再取得して確認（version は 1 → 2 へ進む）
      const updated = await prisma.employee.findUnique({
        where: { employeeCd: "EMP999001" },
      });

      expect(updated?.name).toBe("更新後の名前");
      expect(updated?.version).toBe(2);
    });
  });

  describe("楽観ロック（ADR-0039）", () => {
    it("古い expectedVersion での更新は ConflictError になり、先行の変更は失われない", async () => {
      const saved = await repository.insert(
        Employee.create(
          new EmployeeCd("EMP999001"),
          new MailAddress("test-lock@example.com"),
          new EmployeeName("競合テスト"),
          TEST_DEPT_ID
        )
      );

      // 2人のユーザーが同じ version 1 の編集画面を開いた状況を再現
      const loadedByB = await repository.findById(saved.id);
      const loadedByA = await repository.findById(saved.id);
      expect(loadedByB).not.toBeNull();
      expect(loadedByA).not.toBeNull();
      if (!loadedByB || !loadedByA) return;

      // B が先に保存（version 1 → 2）
      loadedByB.changeName(new EmployeeName("Bの変更"));
      await repository.update(loadedByB, 1);

      // A が古いトークン 1 のまま保存 → 競合として弾かれる
      loadedByA.changeName(new EmployeeName("Aの変更"));
      await expect(repository.update(loadedByA, 1)).rejects.toThrow(ConflictError);

      // B の変更が残っている（後勝ちによる lost update が起きていない）
      const found = await repository.findById(saved.id);
      expect(found?.name.value).toBe("Bの変更");
    });
  });

  describe("delete", () => {
    it("従業員を削除できる", async () => {
      // まず保存
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("test-delete@example.com"),
        new EmployeeName("削除テスト"),
        TEST_DEPT_ID
      );
      const savedEmployee = await repository.insert(employee);

      // 削除
      await repository.delete(savedEmployee.id);

      // 削除されたことを確認
      const deleted = await prisma.employee.findUnique({
        where: { id: savedEmployee.id.value },
      });
      expect(deleted).toBeNull();
    });

    it("担当役割を持つ従業員を削除でき、EmployeeRole 子行も一緒に消える（FK CASCADE 回帰）", async () => {
      // 役割保有従業員を保存（insert で EmployeeRole 子行が 1 件作られる）
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("role-delete@example.com"),
        new EmployeeName("役割あり削除テスト"),
        TEST_DEPT_ID,
        new RoleId(roleAId)
      );
      const savedEmployee = await repository.insert(employee);

      // 前提: 子行が存在すること（RESTRICT 時代はここで delete が FK 違反 P2003 になっていた）
      const before = await prisma.employeeRole.findMany({
        where: { employeeId: savedEmployee.id.value },
      });
      expect(before).toHaveLength(1);

      // 削除は例外なく成功する
      await repository.delete(savedEmployee.id);

      // 従業員本体と EmployeeRole 子行の両方が消えていること（ON DELETE CASCADE）
      const deleted = await prisma.employee.findUnique({
        where: { id: savedEmployee.id.value },
      });
      expect(deleted).toBeNull();

      const afterRows = await prisma.employeeRole.findMany({
        where: { employeeId: savedEmployee.id.value },
      });
      expect(afterRows).toHaveLength(0);
    });
  });

  describe("findById", () => {
    it("IDで従業員を検索できる", async () => {
      // テストデータを保存
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("test-findbyid@example.com"),
        new EmployeeName("ID検索テスト"),
        TEST_DEPT_ID
      );
      const savedEmployee = await repository.insert(employee);

      // findByIdで検索
      const found = await repository.findById(savedEmployee.id);

      expect(found).not.toBeNull();
      expect(found?.id.value).toBe(savedEmployee.id.value);
      expect(found?.name.value).toBe("ID検索テスト");
      expect(found?.email.value).toBe("test-findbyid@example.com");
      expect(found?.employeeCd.value).toBe("EMP999001");
    });

    it("存在しないIDの場合nullを返す", async () => {
      const found = await repository.findById(
        new EmployeeId("00000000-0000-7000-8000-000000000000")
      );

      expect(found).toBeNull();
    });
  });

  describe("findByEmployeeCd", () => {
    it("社員コードで従業員を検索できる", async () => {
      // テストデータを保存
      const employee = Employee.create(
        new EmployeeCd("EMP999002"),
        new MailAddress("test-findbycd@example.com"),
        new EmployeeName("社員コード検索テスト"),
        TEST_DEPT_ID
      );
      await repository.insert(employee);

      // findByEmployeeCdで検索
      const found = await repository.findByEmployeeCd(new EmployeeCd("EMP999002"));

      expect(found).not.toBeNull();
      expect(found?.employeeCd.value).toBe("EMP999002");
      expect(found?.name.value).toBe("社員コード検索テスト");
      expect(found?.email.value).toBe("test-findbycd@example.com");
    });

    it("存在しない社員コードの場合nullを返す", async () => {
      const found = await repository.findByEmployeeCd(new EmployeeCd("EMP999999"));

      expect(found).toBeNull();
    });

    it("複数の従業員から正しい従業員を検索できる", async () => {
      // 複数のテストデータを保存
      const employee1 = Employee.create(
        new EmployeeCd("EMP999002"),
        new MailAddress("test1@example.com"),
        new EmployeeName("テスト1"),
        TEST_DEPT_ID
      );
      const employee2 = Employee.create(
        new EmployeeCd("EMP999003"),
        new MailAddress("test2@example.com"),
        new EmployeeName("テスト2"),
        TEST_DEPT_ID
      );

      await repository.insert(employee1);
      await repository.insert(employee2);

      // EMP999003を検索
      const found = await repository.findByEmployeeCd(new EmployeeCd("EMP999003"));

      expect(found).not.toBeNull();
      expect(found?.employeeCd.value).toBe("EMP999003");
      expect(found?.name.value).toBe("テスト2");
    });
  });

  describe("担当役割の永続化（EmployeeRole 子行の 0/1 件同期）", () => {
    it("担当役割ありで保存すると EmployeeRole 子行が 1 件作られ、findById で復元される", async () => {
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("role-insert@example.com"),
        new EmployeeName("役割あり従業員"),
        TEST_DEPT_ID,
        new RoleId(roleAId)
      );

      const saved = await repository.insert(employee);

      const rows = await prisma.employeeRole.findMany({
        where: { employeeId: saved.id.value },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].roleId).toBe(roleAId);

      const found = await repository.findById(saved.id);
      expect(found?.assignedRoleId?.value).toBe(roleAId);
    });

    it("担当役割なしで保存すると EmployeeRole 子行は作られず、assignedRoleId は null になる", async () => {
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("role-none@example.com"),
        new EmployeeName("役割なし従業員"),
        TEST_DEPT_ID
      );

      const saved = await repository.insert(employee);

      const rows = await prisma.employeeRole.findMany({
        where: { employeeId: saved.id.value },
      });
      expect(rows).toHaveLength(0);

      const found = await repository.findById(saved.id);
      expect(found?.assignedRoleId).toBeNull();
    });

    it("更新で担当役割を別の役割に置換すると、旧行が消え新行だけが残る", async () => {
      const saved = await repository.insert(
        Employee.create(
          new EmployeeCd("EMP999001"),
          new MailAddress("role-replace@example.com"),
          new EmployeeName("役割置換従業員"),
          TEST_DEPT_ID,
          new RoleId(roleAId)
        )
      );

      saved.changeRole(new RoleId(roleBId));
      const updated = await repository.update(saved, 1);

      expect(updated.assignedRoleId?.value).toBe(roleBId);

      const rows = await prisma.employeeRole.findMany({
        where: { employeeId: saved.id.value },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].roleId).toBe(roleBId);
    });

    it("更新で担当役割を解除すると、EmployeeRole 子行が消える", async () => {
      const saved = await repository.insert(
        Employee.create(
          new EmployeeCd("EMP999001"),
          new MailAddress("role-clear@example.com"),
          new EmployeeName("役割解除従業員"),
          TEST_DEPT_ID,
          new RoleId(roleAId)
        )
      );

      saved.changeRole(null);
      const updated = await repository.update(saved, 1);

      expect(updated.assignedRoleId).toBeNull();

      const rows = await prisma.employeeRole.findMany({
        where: { employeeId: saved.id.value },
      });
      expect(rows).toHaveLength(0);
    });
  });

  describe("課員の上位役割の永続化（EmployeeSuperiorRole 行の 0/1 件同期）", () => {
    it("課員に明示上位役割ありで保存すると行が 1 件作られ、findById で復元される", async () => {
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("sup-insert@example.com"),
        new EmployeeName("上位役割あり課員"),
        TEST_DEPT_ID,
        null,
        new RoleId(roleAId)
      );

      const saved = await repository.insert(employee);

      const rows = await prisma.employeeSuperiorRole.findMany({
        where: { employeeId: saved.id.value },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].roleId).toBe(roleAId);

      const found = await repository.findById(saved.id);
      expect(found?.explicitSuperiorRoleId?.value).toBe(roleAId);
    });

    it("課員に明示上位役割なしで保存すると行は作られず、explicitSuperiorRoleId は null になる", async () => {
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("sup-none@example.com"),
        new EmployeeName("上位役割なし課員"),
        TEST_DEPT_ID
      );

      const saved = await repository.insert(employee);

      const rows = await prisma.employeeSuperiorRole.findMany({
        where: { employeeId: saved.id.value },
      });
      expect(rows).toHaveLength(0);

      const found = await repository.findById(saved.id);
      expect(found?.explicitSuperiorRoleId).toBeNull();
    });

    it("役割持ちで保存すると EmployeeSuperiorRole 行は作られない（I1）", async () => {
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("sup-roleholder@example.com"),
        new EmployeeName("役割持ち従業員"),
        TEST_DEPT_ID,
        new RoleId(roleAId)
      );

      const saved = await repository.insert(employee);

      const rows = await prisma.employeeSuperiorRole.findMany({
        where: { employeeId: saved.id.value },
      });
      expect(rows).toHaveLength(0);
    });

    it("更新で課員の上位役割を別役割へ置換すると、旧行が消え新行だけが残る", async () => {
      const saved = await repository.insert(
        Employee.create(
          new EmployeeCd("EMP999001"),
          new MailAddress("sup-replace@example.com"),
          new EmployeeName("上位役割置換課員"),
          TEST_DEPT_ID,
          null,
          new RoleId(roleAId)
        )
      );

      saved.changeSuperiorRole(new RoleId(roleBId));
      const updated = await repository.update(saved, 1);

      expect(updated.explicitSuperiorRoleId?.value).toBe(roleBId);

      const rows = await prisma.employeeSuperiorRole.findMany({
        where: { employeeId: saved.id.value },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].roleId).toBe(roleBId);
    });

    it("更新で課員の上位役割を解除すると、EmployeeSuperiorRole 行が消える", async () => {
      const saved = await repository.insert(
        Employee.create(
          new EmployeeCd("EMP999001"),
          new MailAddress("sup-clear@example.com"),
          new EmployeeName("上位役割解除課員"),
          TEST_DEPT_ID,
          null,
          new RoleId(roleAId)
        )
      );

      saved.changeSuperiorRole(null);
      const updated = await repository.update(saved, 1);

      expect(updated.explicitSuperiorRoleId).toBeNull();

      const rows = await prisma.employeeSuperiorRole.findMany({
        where: { employeeId: saved.id.value },
      });
      expect(rows).toHaveLength(0);
    });
  });

  // findAll は EmployeeRepository から削除されました
  // 一覧取得には EmployeeQueryService を使用してください
});
