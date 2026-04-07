import { EmployeeId } from "@subdomains/employee/domain/values/EmployeeId";
import { EmployeeCd } from "@subdomains/employee/domain/values/EmployeeCd";
import { EmployeeName } from "@subdomains/employee/domain/values/EmployeeName";
import { MailAddress } from "@server/shared/domain/values/MailAddress";
import { DepartmentId } from "@subdomains/department/domain/values/DepartmentId";
import { describe, expect, it, beforeEach } from "vitest";
import { Employee } from "../Employee";

describe("Employee エンティティ", () => {
  let employeeCd: EmployeeCd;
  let email: MailAddress;
  let name: EmployeeName;
  let departmentId: DepartmentId;

  beforeEach(() => {
    employeeCd = new EmployeeCd("EMP000001");
    email = new MailAddress("test@example.com");
    name = new EmployeeName("山田太郎");
    departmentId = DepartmentId.generate();
  });

  describe("ファクトリメソッド", () => {
    describe("create", () => {
      it("新規従業員を作成できる", () => {
        const employee = Employee.create(employeeCd, email, name, departmentId);

        expect(employee.id).toBeInstanceOf(EmployeeId);
        expect(employee.id.value).toBeTruthy();
        expect(employee.employeeCd.value).toBe("EMP000001");
        expect(employee.email.value).toBe("test@example.com");
        expect(employee.name.value).toBe("山田太郎");
        expect(employee.departmentId).toBe(departmentId);
      });

      it("作成日時と更新日時が設定される", () => {
        const employee = Employee.create(employeeCd, email, name, departmentId);

        expect(employee.createdAt).toBeInstanceOf(Date);
        expect(employee.updatedAt).toBeInstanceOf(Date);
      });

      it("作成するたびに一意のIDが生成される", () => {
        const employee1 = Employee.create(employeeCd, email, name, departmentId);
        const employee2 = Employee.create(employeeCd, email, name, departmentId);

        expect(employee1.id.value).not.toBe(employee2.id.value);
      });
    });

    describe("reconstruct", () => {
      it("DBから従業員を再構築できる", () => {
        const id = EmployeeId.generate();
        const createdAt = new Date("2025-01-01");
        const updatedAt = new Date("2025-01-02");

        const employee = Employee.reconstruct(
          id,
          employeeCd,
          email,
          name,
          departmentId,
          createdAt,
          updatedAt
        );

        expect(employee.id).toBe(id);
        expect(employee.employeeCd.value).toBe("EMP000001");
        expect(employee.email.value).toBe("test@example.com");
        expect(employee.name.value).toBe("山田太郎");
        expect(employee.departmentId).toBe(departmentId);
        expect(employee.createdAt).toEqual(createdAt);
        expect(employee.updatedAt).toEqual(updatedAt);
      });
    });
  });

  describe("名前変更", () => {
    it("名前を変更できる", () => {
      const employee = Employee.create(employeeCd, email, name, departmentId);
      const newName = new EmployeeName("鈴木花子");

      employee.changeName(newName);

      expect(employee.name.value).toBe("鈴木花子");
    });

    it("更新日時が更新される", () => {
      const employee = Employee.create(employeeCd, email, name, departmentId);
      const oldUpdatedAt = employee.updatedAt;
      const newName = new EmployeeName("鈴木花子");

      setTimeout(() => {
        employee.changeName(newName);
        expect(employee.updatedAt.getTime()).toBeGreaterThanOrEqual(oldUpdatedAt.getTime());
      }, 10);
    });
  });

  describe("メールアドレス変更", () => {
    it("メールアドレスを変更できる", () => {
      const employee = Employee.create(employeeCd, email, name, departmentId);
      const newEmail = new MailAddress("new@example.com");

      employee.changeEmail(newEmail);

      expect(employee.email.value).toBe("new@example.com");
    });

    it("更新日時が更新される", () => {
      const employee = Employee.create(employeeCd, email, name, departmentId);
      const oldUpdatedAt = employee.updatedAt;
      const newEmail = new MailAddress("new@example.com");

      setTimeout(() => {
        employee.changeEmail(newEmail);
        expect(employee.updatedAt.getTime()).toBeGreaterThanOrEqual(oldUpdatedAt.getTime());
      }, 10);
    });
  });

  describe("部署変更", () => {
    it("所属部署を変更できる", () => {
      const employee = Employee.create(employeeCd, email, name, departmentId);
      const newDepartmentId = DepartmentId.generate();

      employee.changeDepartment(newDepartmentId);

      expect(employee.departmentId).toBe(newDepartmentId);
    });

    it("更新日時が更新される", () => {
      const employee = Employee.create(employeeCd, email, name, departmentId);
      const oldUpdatedAt = employee.updatedAt;
      const newDepartmentId = DepartmentId.generate();

      setTimeout(() => {
        employee.changeDepartment(newDepartmentId);
        expect(employee.updatedAt.getTime()).toBeGreaterThanOrEqual(oldUpdatedAt.getTime());
      }, 10);
    });
  });

  describe("ゲッター", () => {
    it("すべてのフィールドにアクセスできる", () => {
      const id = EmployeeId.generate();
      const createdAt = new Date("2025-01-01");
      const updatedAt = new Date("2025-01-02");

      const employee = Employee.reconstruct(
        id,
        employeeCd,
        email,
        name,
        departmentId,
        createdAt,
        updatedAt
      );

      expect(employee.id).toBe(id);
      expect(employee.employeeCd).toBe(employeeCd);
      expect(employee.email).toBe(email);
      expect(employee.name).toBe(name);
      expect(employee.departmentId).toBe(departmentId);
      expect(employee.createdAt).toEqual(createdAt);
      expect(employee.updatedAt).toEqual(updatedAt);
    });
  });
});
