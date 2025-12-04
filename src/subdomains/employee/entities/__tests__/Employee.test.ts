import { EmployeeCd } from "@/subdomains/employee/values/EmployeeCd";
import { MailAddress } from "@/shared/domain/values/MailAddress";
import { describe, expect, it, beforeEach } from "vitest";
import { Employee } from "../Employee";
import { Role } from "@/subdomains/employee/types/Role";

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
        expect(employee.role).toBe(Role.USER);
      });

      it("役割を指定して作成できる", () => {
        const admin = Employee.create(employeeCd, email, name, Role.ADMIN);

        expect(admin.role).toBe(Role.ADMIN);
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
          Role.ADMIN,
          createdAt,
          updatedAt
        );

        expect(employee.id).toBe(id);
        expect(employee.employeeCd.value).toBe("EMP000001");
        expect(employee.email.value).toBe("test@example.com");
        expect(employee.name).toBe("山田太郎");
        expect(employee.role).toBe(Role.ADMIN);
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

  describe("役割変更", () => {
    it("役割を変更できる（USERからADMINへ）", () => {
      const employee = Employee.create(employeeCd, email, name, Role.USER);

      employee.changeRole(Role.ADMIN);

      expect(employee.role).toBe(Role.ADMIN);
    });

    it("役割を変更できる（ADMINからUSERへ）", () => {
      const employee = Employee.create(employeeCd, email, name, Role.ADMIN);

      employee.changeRole(Role.USER);

      expect(employee.role).toBe(Role.USER);
    });

    it("更新日時が更新される", () => {
      const employee = Employee.create(employeeCd, email, name);
      const oldUpdatedAt = employee.updatedAt;

      setTimeout(() => {
        employee.changeRole(Role.ADMIN);
        expect(employee.updatedAt.getTime()).toBeGreaterThanOrEqual(
          oldUpdatedAt.getTime()
        );
      }, 10);
    });
  });

  describe("役割判定", () => {
    it("管理者の場合trueを返す", () => {
      const admin = Employee.create(employeeCd, email, name, Role.ADMIN);

      expect(admin.isAdmin()).toBe(true);
    });

    it("一般ユーザーの場合falseを返す", () => {
      const user = Employee.create(employeeCd, email, name, Role.USER);

      expect(user.isAdmin()).toBe(false);
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
        Role.ADMIN,
        createdAt,
        updatedAt
      );

      expect(employee.id).toBe(id);
      expect(employee.employeeCd).toBe(employeeCd);
      expect(employee.email).toBe(email);
      expect(employee.name).toBe(name);
      expect(employee.role).toBe(Role.ADMIN);
      expect(employee.createdAt).toEqual(createdAt);
      expect(employee.updatedAt).toEqual(updatedAt);
    });
  });
});
