import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { PrismaEmployeeRepository } from "../PrismaEmployeeRepository";
import prisma from "@server/prisma";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("PrismaEmployeeRepository", () => {
  let repository: PrismaEmployeeRepository;

  beforeEach(async () => {
    repository = new PrismaEmployeeRepository();
    // テストデータのクリーンアップ
    await prisma.employee.deleteMany({
      where: {
        employeeCd: {
          in: ["EMP999001", "EMP999002", "EMP999003"],
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
  });

  afterEach(async () => {
    // テストデータのクリーンアップ
    await prisma.employee.deleteMany({
      where: {
        employeeCd: {
          in: ["EMP999001", "EMP999002", "EMP999003"],
        },
      },
    });
  });

  describe("save", () => {
    it("新規従業員を保存できる", async () => {
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("test-save@example.com"),
        new EmployeeName("テスト太郎"),
        "dept-001"
      );

      const savedEmployee = await repository.save(employee);

      // 保存されたエンティティを確認
      expect(savedEmployee).not.toBeNull();
      expect(savedEmployee.id).toBeTruthy();
      expect(savedEmployee.employeeCd.value).toBe("EMP999001");
      expect(savedEmployee.email.value).toBe("test-save@example.com");
      expect(savedEmployee.name.value).toBe("テスト太郎");

      // DBから取得して確認
      const saved = await prisma.employee.findUnique({
        where: { employeeCd: "EMP999001" },
      });

      expect(saved).not.toBeNull();
      expect(saved?.employeeCd).toBe("EMP999001");
      expect(saved?.email).toBe("test-save@example.com");
      expect(saved?.name).toBe("テスト太郎");
    });
  });

  describe("save (update)", () => {
    it("既存従業員を更新できる", async () => {
      // まず保存
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("test-update@example.com"),
        new EmployeeName("更新前の名前"),
        "dept-001"
      );
      const savedEmployee = await repository.save(employee);

      // 名前を変更
      savedEmployee.changeName(new EmployeeName("更新後の名前"));
      const updatedEmployee = await repository.save(savedEmployee);

      // 更新されたエンティティを確認
      expect(updatedEmployee.name.value).toBe("更新後の名前");
      expect(updatedEmployee.id).toBe(savedEmployee.id);

      // DBから再取得して確認
      const updated = await prisma.employee.findUnique({
        where: { employeeCd: "EMP999001" },
      });

      expect(updated?.name).toBe("更新後の名前");
    });
  });

  describe("delete", () => {
    it("従業員を削除できる", async () => {
      // まず保存
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("test-delete@example.com"),
        new EmployeeName("削除テスト"),
        "dept-001"
      );
      const savedEmployee = await repository.save(employee);

      // 削除
      await repository.delete(savedEmployee.id);

      // 削除されたことを確認
      const deleted = await prisma.employee.findUnique({
        where: { id: savedEmployee.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe("findById", () => {
    it("IDで従業員を検索できる", async () => {
      // テストデータを保存
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("test-findbyid@example.com"),
        new EmployeeName("ID検索テスト"),
        "dept-001"
      );
      const savedEmployee = await repository.save(employee);

      // findByIdで検索
      const found = await repository.findById(savedEmployee.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(savedEmployee.id);
      expect(found?.name.value).toBe("ID検索テスト");
      expect(found?.email.value).toBe("test-findbyid@example.com");
      expect(found?.employeeCd.value).toBe("EMP999001");
    });

    it("存在しないIDの場合nullを返す", async () => {
      const found = await repository.findById("non-existent-id");

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
        "dept-001"
      );
      await repository.save(employee);

      // findByEmployeeCdで検索
      const found = await repository.findByEmployeeCd(
        new EmployeeCd("EMP999002")
      );

      expect(found).not.toBeNull();
      expect(found?.employeeCd.value).toBe("EMP999002");
      expect(found?.name.value).toBe("社員コード検索テスト");
      expect(found?.email.value).toBe("test-findbycd@example.com");
    });

    it("存在しない社員コードの場合nullを返す", async () => {
      const found = await repository.findByEmployeeCd(
        new EmployeeCd("EMP999999")
      );

      expect(found).toBeNull();
    });

    it("複数の従業員から正しい従業員を検索できる", async () => {
      // 複数のテストデータを保存
      const employee1 = Employee.create(
        new EmployeeCd("EMP999002"),
        new MailAddress("test1@example.com"),
        new EmployeeName("テスト1"),
        "dept-001"
      );
      const employee2 = Employee.create(
        new EmployeeCd("EMP999003"),
        new MailAddress("test2@example.com"),
        new EmployeeName("テスト2"),
        "dept-001"
      );

      await repository.save(employee1);
      await repository.save(employee2);

      // EMP999003を検索
      const found = await repository.findByEmployeeCd(
        new EmployeeCd("EMP999003")
      );

      expect(found).not.toBeNull();
      expect(found?.employeeCd.value).toBe("EMP999003");
      expect(found?.name.value).toBe("テスト2");
    });
  });

  // findAll は IEmployeeRepository から削除されました
  // 一覧取得には IEmployeeQueryService を使用してください
});
