import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { describe, expect, it, beforeEach } from "vitest";
import { Employee } from "../Employee";

describe("Employee エンティティ", () => {
  let employeeCd: EmployeeCd;
  let email: MailAddress;
  let name: string;

  beforeEach(() => {
    employeeCd = new EmployeeCd("EMP000001");
    email = new MailAddress("test@example.com");
    name = "山田太郎";
  });

  describe("ファクトリメソッド", () => {
    describe("create", () => {
      it("新規従業員を作成できる", () => {
        const employee = Employee.create(employeeCd, email, name);

        expect(employee.id).toBeTruthy(); // IDが生成されている
        expect(employee.id).not.toBe(""); // 空文字ではない
        expect(employee.employeeCd.value).toBe("EMP000001");
        expect(employee.email.value).toBe("test@example.com");
        expect(employee.name).toBe("山田太郎");
      });

      it("作成日時と更新日時が設定される", () => {
        const employee = Employee.create(employeeCd, email, name);

        expect(employee.createdAt).toBeInstanceOf(Date);
        expect(employee.updatedAt).toBeInstanceOf(Date);
      });

      it("作成するたびに一意のIDが生成される", () => {
        const employee1 = Employee.create(employeeCd, email, name);
        const employee2 = Employee.create(employeeCd, email, name);

        expect(employee1.id).not.toBe(employee2.id);
      });
    });

    describe("reconstruct", () => {
      it("DBから従業員を再構築できる", () => {
        const id = "clxyz123abc456def789";
        const createdAt = new Date("2025-01-01");
        const updatedAt = new Date("2025-01-02");

        const employee = Employee.reconstruct(
          id,
          employeeCd,
          email,
          name,
          createdAt,
          updatedAt
        );

        expect(employee.id).toBe(id);
        expect(employee.employeeCd.value).toBe("EMP000001");
        expect(employee.email.value).toBe("test@example.com");
        expect(employee.name).toBe("山田太郎");
        expect(employee.createdAt).toEqual(createdAt);
        expect(employee.updatedAt).toEqual(updatedAt);
      });
    });
  });

  describe("名前変更", () => {
    it("名前を変更できる", () => {
      const employee = Employee.create(employeeCd, email, name);
      const newName = "鈴木花子";

      employee.changeName(newName);

      expect(employee.name).toBe("鈴木花子");
    });

    it("更新日時が更新される", () => {
      const employee = Employee.create(employeeCd, email, name);
      const oldUpdatedAt = employee.updatedAt;
      const newName = "鈴木花子";

      setTimeout(() => {
        employee.changeName(newName);
        expect(employee.updatedAt.getTime()).toBeGreaterThanOrEqual(
          oldUpdatedAt.getTime()
        );
      }, 10);
    });
  });

  describe("メールアドレス変更", () => {
    it("メールアドレスを変更できる", () => {
      const employee = Employee.create(employeeCd, email, name);
      const newEmail = new MailAddress("new@example.com");

      employee.changeEmail(newEmail);

      expect(employee.email.value).toBe("new@example.com");
    });

    it("更新日時が更新される", () => {
      const employee = Employee.create(employeeCd, email, name);
      const oldUpdatedAt = employee.updatedAt;
      const newEmail = new MailAddress("new@example.com");

      setTimeout(() => {
        employee.changeEmail(newEmail);
        expect(employee.updatedAt.getTime()).toBeGreaterThanOrEqual(
          oldUpdatedAt.getTime()
        );
      }, 10);
    });
  });

  describe("ゲッター", () => {
    it("すべてのフィールドにアクセスできる", () => {
      const id = "clxyz123abc456def789";
      const createdAt = new Date("2025-01-01");
      const updatedAt = new Date("2025-01-02");

      const employee = Employee.reconstruct(
        id,
        employeeCd,
        email,
        name,
        createdAt,
        updatedAt
      );

      expect(employee.id).toBe(id);
      expect(employee.employeeCd).toBe(employeeCd);
      expect(employee.email).toBe(email);
      expect(employee.name).toBe(name);
      expect(employee.createdAt).toEqual(createdAt);
      expect(employee.updatedAt).toEqual(updatedAt);
    });
  });
});
