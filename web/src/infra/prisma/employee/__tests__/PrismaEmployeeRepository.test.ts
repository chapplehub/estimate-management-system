import { Employee } from "@/domain/entities/Employee";
import { Role } from "@/domain/types/Role";
import { EmployeeCd } from "@/domain/value/EmployeeCd";
import { MailAddress } from "@/domain/value/MailAddress";
import { PrismaEmployeeRepository } from "@/infra/prisma/employee/PrismaEmployeeRepository";
import prisma from "@lib/prisma";
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
        "テスト太郎",
        "hashed_password_123",
        Role.USER
      );

      const savedEmployee = await repository.save(employee);

      // 保存されたエンティティを確認
      expect(savedEmployee).not.toBeNull();
      expect(savedEmployee.id).toBeTruthy();
      expect(savedEmployee.employeeCd.value).toBe("EMP999001");
      expect(savedEmployee.email.value).toBe("test-save@example.com");
      expect(savedEmployee.name).toBe("テスト太郎");
      expect(savedEmployee.role).toBe(Role.USER);

      // DBから取得して確認
      const saved = await prisma.employee.findUnique({
        where: { employeeCd: "EMP999001" },
      });

      expect(saved).not.toBeNull();
      expect(saved?.employeeCd).toBe("EMP999001");
      expect(saved?.email).toBe("test-save@example.com");
      expect(saved?.name).toBe("テスト太郎");
      expect(saved?.role).toBe(Role.USER);
    });
  });

  describe("save (update)", () => {
    it("既存従業員を更新できる", async () => {
      // まず保存
      const employee = Employee.create(
        new EmployeeCd("EMP999001"),
        new MailAddress("test-update@example.com"),
        "更新前の名前",
        "hashed_password_123",
        Role.USER
      );
      const savedEmployee = await repository.save(employee);

      // 名前を変更
      savedEmployee.changeName("更新後の名前");
      const updatedEmployee = await repository.save(savedEmployee);

      // 更新されたエンティティを確認
      expect(updatedEmployee.name).toBe("更新後の名前");
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
        "削除テスト",
        "hashed_password_123",
        Role.USER
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
        "ID検索テスト",
        "hashed_password_123",
        Role.USER
      );
      const savedEmployee = await repository.save(employee);

      // findByIdで検索
      const found = await repository.findById(savedEmployee.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(savedEmployee.id);
      expect(found?.name).toBe("ID検索テスト");
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
        "社員コード検索テスト",
        "hashed_password_123",
        Role.ADMIN
      );
      await repository.save(employee);

      // findByEmployeeCdで検索
      const found = await repository.findByEmployeeCd(
        new EmployeeCd("EMP999002")
      );

      expect(found).not.toBeNull();
      expect(found?.employeeCd.value).toBe("EMP999002");
      expect(found?.name).toBe("社員コード検索テスト");
      expect(found?.email.value).toBe("test-findbycd@example.com");
      expect(found?.role).toBe(Role.ADMIN);
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
        "テスト1",
        "hashed_password_123",
        Role.USER
      );
      const employee2 = Employee.create(
        new EmployeeCd("EMP999003"),
        new MailAddress("test2@example.com"),
        "テスト2",
        "hashed_password_456",
        Role.ADMIN
      );

      await repository.save(employee1);
      await repository.save(employee2);

      // EMP999003を検索
      const found = await repository.findByEmployeeCd(
        new EmployeeCd("EMP999003")
      );

      expect(found).not.toBeNull();
      expect(found?.employeeCd.value).toBe("EMP999003");
      expect(found?.name).toBe("テスト2");
      expect(found?.role).toBe(Role.ADMIN);
    });
  });

  // findAll は IEmployeeRepository から削除されました
  // 一覧取得には IEmployeeQueryService を使用してください
});
