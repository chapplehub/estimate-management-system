import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryEmployeeRepository } from "../InMemoryEmployeeRepository";
import { Employee } from "@subdomains/employee/domain/entities/Employee";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { MailAddress } from "@server/shared/domain/values/MailAddress";

describe("InMemoryEmployeeRepository", () => {
  let repository: InMemoryEmployeeRepository;
  let employee: Employee;

  beforeEach(() => {
    repository = new InMemoryEmployeeRepository();
    employee = Employee.create(
      new EmployeeCd("EMP000001"),
      new MailAddress("test@example.com"),
      "山田太郎"
    );
  });

  describe("save", () => {
    it("従業員を保存できる", async () => {
      const saved = await repository.save(employee);

      const found = await repository.findById(saved.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(saved.id);
    });

    it("複数の従業員を保存できる", async () => {
      const employee2 = Employee.create(
        new EmployeeCd("EMP000002"),
        new MailAddress("test2@example.com"),
        "鈴木花子"
      );

      const saved1 = await repository.save(employee);
      const saved2 = await repository.save(employee2);

      const found1 = await repository.findById(saved1.id);
      const found2 = await repository.findById(saved2.id);

      expect(found1).not.toBeNull();
      expect(found2).not.toBeNull();
      expect(found1?.name).toBe("山田太郎");
      expect(found2?.name).toBe("鈴木花子");
    });
  });

  describe("save (update)", () => {
    it("従業員を更新できる", async () => {
      const saved = await repository.save(employee);

      saved.changeName("山田次郎");
      await repository.save(saved);

      const found = await repository.findByEmployeeCd(saved.employeeCd);
      expect(found?.name).toBe("山田次郎");
    });
  });

  describe("delete", () => {
    it("従業員を削除できる", async () => {
      const saved = await repository.save(employee);

      const foundBefore = await repository.findById(saved.id);
      expect(foundBefore).not.toBeNull();

      await repository.delete(saved.id);

      const foundAfter = await repository.findById(saved.id);
      expect(foundAfter).toBeNull();
    });

    it("存在しないIDを削除しようとしても例外が発生しない", async () => {
      await expect(
        repository.delete("non-existent-id")
      ).resolves.toBeUndefined();
    });
  });

  describe("findById", () => {
    it("IDで従業員を検索できる", async () => {
      const saved = await repository.save(employee);

      const found = await repository.findById(saved.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(saved.id);
      expect(found?.name).toBe("山田太郎");
      expect(found?.email.value).toBe("test@example.com");
    });

    it("存在しないIDの場合nullを返す", async () => {
      const found = await repository.findById("non-existent-id");

      expect(found).toBeNull();
    });

    it("削除された従業員はnullを返す", async () => {
      const saved = await repository.save(employee);
      await repository.delete(saved.id);

      const found = await repository.findById(saved.id);

      expect(found).toBeNull();
    });
  });

  describe("findByEmployeeCd", () => {
    it("社員コードで従業員を検索できる", async () => {
      await repository.save(employee);

      const found = await repository.findByEmployeeCd(
        new EmployeeCd("EMP000001")
      );

      expect(found).not.toBeNull();
      expect(found?.employeeCd.value).toBe("EMP000001");
      expect(found?.name).toBe("山田太郎");
    });

    it("存在しない社員コードの場合nullを返す", async () => {
      const found = await repository.findByEmployeeCd(
        new EmployeeCd("EMP999999")
      );

      expect(found).toBeNull();
    });

    it("複数の従業員から正しい従業員を検索できる", async () => {
      const employee2 = Employee.create(
        new EmployeeCd("EMP000002"),
        new MailAddress("test2@example.com"),
        "鈴木花子"
      );

      await repository.save(employee);
      await repository.save(employee2);

      const found = await repository.findByEmployeeCd(
        new EmployeeCd("EMP000002")
      );

      expect(found).not.toBeNull();
      expect(found?.name).toBe("鈴木花子");
    });

    it("削除された従業員はnullを返す", async () => {
      const saved = await repository.save(employee);
      await repository.delete(saved.id);

      const found = await repository.findByEmployeeCd(
        new EmployeeCd("EMP000001")
      );

      expect(found).toBeNull();
    });
  });

  // findAll は IEmployeeRepository から削除されました
  // 一覧取得には IEmployeeQueryService を使用してください
});
