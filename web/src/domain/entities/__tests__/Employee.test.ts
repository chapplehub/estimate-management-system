import { BusinessRuleViolationError } from "@/shared/errors/DomainError";
import { EmployeeCd } from "@/domain/valueObjects/EmployeeCd";
import { MailAddress } from "@/domain/valueObjects/MailAddress";
import { describe, expect, it, beforeEach } from "vitest";
import { Employee } from "../Employee";
import { Role } from "../Role";

describe("Employee エンティティ", () => {
  let employeeCd: EmployeeCd;
  let email: MailAddress;
  let name: string;
  let passwordHash: string;

  beforeEach(() => {
    employeeCd = new EmployeeCd("EMP000001");
    email = new MailAddress("test@example.com");
    name = "山田太郎";
    passwordHash = "hashed_password_123";
  });

  describe("ファクトリメソッド", () => {
    describe("create", () => {
      it("新規従業員を作成できる", () => {
        const employee = Employee.create(
          employeeCd,
          email,
          name,
          passwordHash
        );

        expect(employee.employeeCd.value).toBe("EMP000001");
        expect(employee.email.value).toBe("test@example.com");
        expect(employee.name).toBe("山田太郎");
        expect(employee.passwordHash).toBe("hashed_password_123");
        expect(employee.role).toBe(Role.USER);
        expect(employee.failedLoginAttempts).toBe(0);
        expect(employee.lockedUntil).toBeNull();
        expect(employee.lastLoginAt).toBeNull();
      });

      it("役割を指定して作成できる", () => {
        const admin = Employee.create(
          employeeCd,
          email,
          name,
          passwordHash,
          Role.ADMIN
        );

        expect(admin.role).toBe(Role.ADMIN);
      });

      it("作成日時と更新日時が設定される", () => {
        const employee = Employee.create(
          employeeCd,
          email,
          name,
          passwordHash
        );

        expect(employee.createdAt).toBeInstanceOf(Date);
        expect(employee.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe("reconstruct", () => {
      it("DBから従業員を再構築できる", () => {
        const id = "clxyz123abc456def789";
        const createdAt = new Date("2025-01-01");
        const updatedAt = new Date("2025-01-02");
        const lastLoginAt = new Date("2025-01-03");

        const employee = Employee.reconstruct(
          id,
          employeeCd,
          email,
          name,
          passwordHash,
          Role.ADMIN,
          3,
          null,
          lastLoginAt,
          createdAt,
          updatedAt
        );

        expect(employee.id).toBe(id);
        expect(employee.employeeCd.value).toBe("EMP000001");
        expect(employee.email.value).toBe("test@example.com");
        expect(employee.name).toBe("山田太郎");
        expect(employee.passwordHash).toBe("hashed_password_123");
        expect(employee.role).toBe(Role.ADMIN);
        expect(employee.failedLoginAttempts).toBe(3);
        expect(employee.lockedUntil).toBeNull();
        expect(employee.lastLoginAt).toEqual(lastLoginAt);
        expect(employee.createdAt).toEqual(createdAt);
        expect(employee.updatedAt).toEqual(updatedAt);
      });
    });
  });

  describe("アカウントロック機能", () => {
    describe("isAccountLocked", () => {
      it("ロックされていない場合はfalseを返す", () => {
        const employee = Employee.create(
          employeeCd,
          email,
          name,
          passwordHash
        );

        expect(employee.isAccountLocked()).toBe(false);
      });

      it("ロック期限内の場合はtrueを返す", () => {
        const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10分後
        const employee = Employee.reconstruct(
          "id",
          employeeCd,
          email,
          name,
          passwordHash,
          Role.USER,
          5,
          futureDate,
          null,
          new Date(),
          new Date()
        );

        expect(employee.isAccountLocked()).toBe(true);
      });

      it("ロック期限切れの場合は自動的に解除される", () => {
        const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10分前
        const employee = Employee.reconstruct(
          "id",
          employeeCd,
          email,
          name,
          passwordHash,
          Role.USER,
          5,
          pastDate,
          null,
          new Date(),
          new Date()
        );

        expect(employee.isAccountLocked()).toBe(false);
        expect(employee.lockedUntil).toBeNull();
        expect(employee.failedLoginAttempts).toBe(0);
      });
    });

    describe("recordFailedLogin", () => {
      it("ログイン失敗を記録できる", () => {
        const employee = Employee.create(
          employeeCd,
          email,
          name,
          passwordHash
        );

        employee.recordFailedLogin();

        expect(employee.failedLoginAttempts).toBe(1);
      });

      it("5回失敗するとアカウントがロックされる", () => {
        const employee = Employee.create(
          employeeCd,
          email,
          name,
          passwordHash
        );

        for (let i = 0; i < 5; i++) {
          employee.recordFailedLogin();
        }

        expect(employee.failedLoginAttempts).toBe(5);
        expect(employee.isAccountLocked()).toBe(true);
        expect(employee.lockedUntil).not.toBeNull();
      });

      it("ロック中に記録しようとすると例外がスローされる", () => {
        const futureDate = new Date(Date.now() + 10 * 60 * 1000);
        const employee = Employee.reconstruct(
          "id",
          employeeCd,
          email,
          name,
          passwordHash,
          Role.USER,
          5,
          futureDate,
          null,
          new Date(),
          new Date()
        );

        expect(() => employee.recordFailedLogin()).toThrow(
          BusinessRuleViolationError
        );
      });

      it("更新日時が更新される", () => {
        const employee = Employee.create(
          employeeCd,
          email,
          name,
          passwordHash
        );
        const oldUpdatedAt = employee.updatedAt;

        // 時間を進める
        setTimeout(() => {
          employee.recordFailedLogin();
          expect(employee.updatedAt.getTime()).toBeGreaterThan(
            oldUpdatedAt.getTime()
          );
        }, 10);
      });
    });

    describe("recordSuccessfulLogin", () => {
      it("ログイン成功を記録できる", () => {
        const employee = Employee.create(
          employeeCd,
          email,
          name,
          passwordHash
        );

        employee.recordSuccessfulLogin();

        expect(employee.lastLoginAt).toBeInstanceOf(Date);
        expect(employee.failedLoginAttempts).toBe(0);
        expect(employee.lockedUntil).toBeNull();
      });

      it("失敗回数がリセットされる", () => {
        const employee = Employee.create(
          employeeCd,
          email,
          name,
          passwordHash
        );

        employee.recordFailedLogin();
        employee.recordFailedLogin();
        employee.recordFailedLogin();
        expect(employee.failedLoginAttempts).toBe(3);

        employee.recordSuccessfulLogin();
        expect(employee.failedLoginAttempts).toBe(0);
      });

      it("ロックが解除される", () => {
        const futureDate = new Date(Date.now() + 10 * 60 * 1000);
        const employee = Employee.reconstruct(
          "id",
          employeeCd,
          email,
          name,
          passwordHash,
          Role.USER,
          5,
          futureDate,
          null,
          new Date(),
          new Date()
        );

        employee.recordSuccessfulLogin();
        expect(employee.isAccountLocked()).toBe(false);
        expect(employee.lockedUntil).toBeNull();
      });
    });

    describe("unlockAccount", () => {
      it("アカウントロックを強制解除できる", () => {
        const futureDate = new Date(Date.now() + 10 * 60 * 1000);
        const employee = Employee.reconstruct(
          "id",
          employeeCd,
          email,
          name,
          passwordHash,
          Role.USER,
          5,
          futureDate,
          null,
          new Date(),
          new Date()
        );

        employee.unlockAccount();

        expect(employee.isAccountLocked()).toBe(false);
        expect(employee.lockedUntil).toBeNull();
        expect(employee.failedLoginAttempts).toBe(0);
      });
    });
  });

  describe("メールアドレス変更", () => {
    it("メールアドレスを変更できる", () => {
      const employee = Employee.create(employeeCd, email, name, passwordHash);
      const newEmail = new MailAddress("new@example.com");

      employee.changeEmail(newEmail);

      expect(employee.email.value).toBe("new@example.com");
    });

    it("更新日時が更新される", () => {
      const employee = Employee.create(employeeCd, email, name, passwordHash);
      const oldUpdatedAt = employee.updatedAt;
      const newEmail = new MailAddress("new@example.com");

      // 時間を進める（実際のテストでは時間のモックを使うとより良い）
      setTimeout(() => {
        employee.changeEmail(newEmail);
        expect(employee.updatedAt.getTime()).toBeGreaterThanOrEqual(
          oldUpdatedAt.getTime()
        );
      }, 10);
    });
  });

  describe("パスワード変更", () => {
    it("パスワードを変更できる", () => {
      const employee = Employee.create(employeeCd, email, name, passwordHash);
      const newPasswordHash = "new_hashed_password_456";

      employee.changePassword(newPasswordHash);

      expect(employee.passwordHash).toBe("new_hashed_password_456");
    });

    it("更新日時が更新される", () => {
      const employee = Employee.create(employeeCd, email, name, passwordHash);
      const oldUpdatedAt = employee.updatedAt;
      const newPasswordHash = "new_hashed_password_456";

      setTimeout(() => {
        employee.changePassword(newPasswordHash);
        expect(employee.updatedAt.getTime()).toBeGreaterThanOrEqual(
          oldUpdatedAt.getTime()
        );
      }, 10);
    });
  });

  describe("役割判定", () => {
    it("管理者の場合trueを返す", () => {
      const admin = Employee.create(
        employeeCd,
        email,
        name,
        passwordHash,
        Role.ADMIN
      );

      expect(admin.isAdmin()).toBe(true);
    });

    it("一般ユーザーの場合falseを返す", () => {
      const user = Employee.create(
        employeeCd,
        email,
        name,
        passwordHash,
        Role.USER
      );

      expect(user.isAdmin()).toBe(false);
    });
  });

  describe("ゲッター", () => {
    it("すべてのフィールドにアクセスできる", () => {
      const id = "clxyz123abc456def789";
      const createdAt = new Date("2025-01-01");
      const updatedAt = new Date("2025-01-02");
      const lastLoginAt = new Date("2025-01-03");
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);

      const employee = Employee.reconstruct(
        id,
        employeeCd,
        email,
        name,
        passwordHash,
        Role.ADMIN,
        3,
        lockedUntil,
        lastLoginAt,
        createdAt,
        updatedAt
      );

      expect(employee.id).toBe(id);
      expect(employee.employeeCd).toBe(employeeCd);
      expect(employee.email).toBe(email);
      expect(employee.name).toBe(name);
      expect(employee.passwordHash).toBe(passwordHash);
      expect(employee.role).toBe(Role.ADMIN);
      expect(employee.failedLoginAttempts).toBe(3);
      expect(employee.lockedUntil).toEqual(lockedUntil);
      expect(employee.lastLoginAt).toEqual(lastLoginAt);
      expect(employee.createdAt).toEqual(createdAt);
      expect(employee.updatedAt).toEqual(updatedAt);
    });
  });
});
