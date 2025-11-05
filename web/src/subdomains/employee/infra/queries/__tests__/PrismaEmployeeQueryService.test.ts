import { Role } from "@/subdomains/employee/types/Role";
import { PrismaEmployeeQueryService } from "@/subdomains/employee/infra/queries/PrismaEmployeeQueryService";
import prisma from "@lib/prisma";
import { createId } from "@paralleldrive/cuid2";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("PrismaEmployeeQueryService", () => {
  let queryService: PrismaEmployeeQueryService;

  beforeEach(async () => {
    queryService = new PrismaEmployeeQueryService();

    // テストデータのクリーンアップ
    await prisma.employee.deleteMany({
      where: {
        employeeCd: {
          in: [
            "EMP999901",
            "EMP999902",
            "EMP999903",
            "EMP999904",
            "EMP999905",
          ],
        },
      },
    });
  });

  afterEach(async () => {
    // テストデータのクリーンアップ
    await prisma.employee.deleteMany({
      where: {
        employeeCd: {
          in: [
            "EMP999901",
            "EMP999902",
            "EMP999903",
            "EMP999904",
            "EMP999905",
          ],
        },
      },
    });
  });

  describe("findById", () => {
    it("IDで従業員を取得できる", async () => {
      // テストデータを作成
      const employee = await prisma.employee.create({
        data: {
          id: createId(),
          employeeCd: "EMP999901",
          email: "query-findbyid@example.com",
          name: "QueryFindById",
          passwordHash: "hashed_password",
          role: Role.USER,
          failedLoginAttempts: 0,
        },
      });

      // findByIdで取得
      const found = await queryService.findById(employee.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(employee.id);
      expect(found?.employeeCd).toBe("EMP999901");
      expect(found?.email).toBe("query-findbyid@example.com");
      expect(found?.name).toBe("QueryFindById");
      expect(found?.role).toBe(Role.USER);
    });

    it("存在しないIDの場合nullを返す", async () => {
      const found = await queryService.findById("non-existent-id");
      expect(found).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("メールアドレスで従業員を取得できる", async () => {
      await prisma.employee.create({
        data: {
          id: createId(),
          employeeCd: "EMP999902",
          email: "query-email@example.com",
          name: "QueryEmail",
          passwordHash: "hashed_password",
          role: Role.ADMIN,
          failedLoginAttempts: 0,
        },
      });

      const found = await queryService.findByEmail("query-email@example.com");

      expect(found).not.toBeNull();
      expect(found?.email).toBe("query-email@example.com");
      expect(found?.employeeCd).toBe("EMP999902");
      expect(found?.role).toBe(Role.ADMIN);
    });

    it("存在しないメールアドレスの場合nullを返す", async () => {
      const found = await queryService.findByEmail("nonexistent@example.com");
      expect(found).toBeNull();
    });
  });

  describe("findByEmployeeCd", () => {
    it("従業員CDで従業員を取得できる", async () => {
      await prisma.employee.create({
        data: {
          id: createId(),
          employeeCd: "EMP999903",
          email: "query-cd@example.com",
          name: "QueryEmployeeCd",
          passwordHash: "hashed_password",
          role: Role.USER,
          failedLoginAttempts: 0,
        },
      });

      const found = await queryService.findByEmployeeCd("EMP999903");

      expect(found).not.toBeNull();
      expect(found?.employeeCd).toBe("EMP999903");
      expect(found?.email).toBe("query-cd@example.com");
    });

    it("存在しない従業員CDの場合nullを返す", async () => {
      const found = await queryService.findByEmployeeCd("EMP999999");
      expect(found).toBeNull();
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      // 複数のテストデータを作成
      await prisma.employee.createMany({
        data: [
          {
            id: createId(),
            employeeCd: "EMP999901",
            email: "tanaka@example.com",
            name: "田中太郎",
            passwordHash: "hashed_password",
            role: Role.USER,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
          {
            id: createId(),
            employeeCd: "EMP999902",
            email: "yamada@example.com",
            name: "山田花子",
            passwordHash: "hashed_password",
            role: Role.ADMIN,
            failedLoginAttempts: 3,
            lockedUntil: null,
          },
          {
            id: createId(),
            employeeCd: "EMP999903",
            email: "suzuki@example.com",
            name: "鈴木一郎",
            passwordHash: "hashed_password",
            role: Role.USER,
            failedLoginAttempts: 5,
            lockedUntil: new Date(Date.now() + 3600000), // 1時間後までロック
          },
          {
            id: createId(),
            employeeCd: "EMP999904",
            email: "sato@example.com",
            name: "佐藤次郎",
            passwordHash: "hashed_password",
            role: Role.USER,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        ],
      });
    });

    it("名前での部分一致検索ができる", async () => {
      const results = await queryService.search({ name: "田中" });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("田中太郎");
    });

    it("メールアドレスでの部分一致検索ができる", async () => {
      const results = await queryService.search({ email: "yamada" });

      expect(results.length).toBe(1);
      expect(results[0].email).toBe("yamada@example.com");
    });

    it("従業員CDでの完全一致検索ができる", async () => {
      const results = await queryService.search({ employeeCd: "EMP999902" });

      expect(results.length).toBe(1);
      expect(results[0].employeeCd).toBe("EMP999902");
    });

    it("ロールでのフィルタができる", async () => {
      const results = await queryService.search({ role: Role.ADMIN });

      expect(results.length).toBe(1);
      expect(results[0].role).toBe(Role.ADMIN);
      expect(results[0].name).toBe("山田花子");
    });

    it("ロック中の従業員のみ取得できる", async () => {
      const results = await queryService.search({ isLocked: true });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("鈴木一郎");
      expect(results[0].lockedUntil).not.toBeNull();
    });

    it("ロックされていない従業員のみ取得できる", async () => {
      const results = await queryService.search({ isLocked: false });

      // ロックされていない従業員は3人
      expect(results.length).toBeGreaterThanOrEqual(3);
      const names = results.map((r) => r.name);
      expect(names).toContain("田中太郎");
      expect(names).toContain("山田花子");
      expect(names).toContain("佐藤次郎");
    });

    it("複数条件の組み合わせで検索できる", async () => {
      const results = await queryService.search({
        role: Role.USER,
        isLocked: false,
      });

      // USER かつ ロックされていない従業員
      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach((r) => {
        expect(r.role).toBe(Role.USER);
        expect(
          r.lockedUntil === null || r.lockedUntil <= new Date()
        ).toBeTruthy();
      });
    });

    it("limitで取得件数を制限できる", async () => {
      const results = await queryService.search({}, { limit: 2 });

      expect(results.length).toBe(2);
    });

    it("offsetでスキップできる", async () => {
      const allResults = await queryService.search({});
      const offsetResults = await queryService.search({}, { offset: 2 });

      expect(offsetResults.length).toBe(allResults.length - 2);
    });

    it("ソート順を指定できる（昇順）", async () => {
      const results = await queryService.search(
        {},
        {
          orderBy: { field: "name", direction: "asc" },
        }
      );

      expect(results.length).toBeGreaterThanOrEqual(4);
      // 日本語の文字コード順で並んでいるか確認
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].name <= results[i + 1].name).toBe(true);
      }
    });

    it("ソート順を指定できる（降順）", async () => {
      const results = await queryService.search(
        {},
        {
          orderBy: { field: "employeeCd", direction: "desc" },
        }
      );

      expect(results.length).toBeGreaterThanOrEqual(4);
      // 降順で並んでいるか確認
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].employeeCd >= results[i + 1].employeeCd).toBe(true);
      }
    });

    it("条件に一致する従業員がいない場合は空配列を返す", async () => {
      const results = await queryService.search({
        name: "存在しない名前",
      });

      expect(results).toEqual([]);
    });
  });

  describe("findAll", () => {
    beforeEach(async () => {
      // テストデータを作成
      await prisma.employee.createMany({
        data: [
          {
            id: createId(),
            employeeCd: "EMP999901",
            email: "all1@example.com",
            name: "全取得1",
            passwordHash: "hashed_password",
            role: Role.USER,
            failedLoginAttempts: 0,
          },
          {
            id: createId(),
            employeeCd: "EMP999902",
            email: "all2@example.com",
            name: "全取得2",
            passwordHash: "hashed_password",
            role: Role.ADMIN,
            failedLoginAttempts: 0,
          },
        ],
      });
    });

    it("全従業員を取得できる", async () => {
      const results = await queryService.findAll();

      expect(results.length).toBeGreaterThanOrEqual(2);
      const employeeCds = results.map((r) => r.employeeCd);
      expect(employeeCds).toContain("EMP999901");
      expect(employeeCds).toContain("EMP999902");
    });

    it("limitで取得件数を制限できる", async () => {
      const results = await queryService.findAll({ limit: 1 });

      expect(results.length).toBe(1);
    });

    it("ソート順を指定できる", async () => {
      const results = await queryService.findAll({
        orderBy: { field: "employeeCd", direction: "asc" },
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      // 昇順になっているか確認
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].employeeCd <= results[i + 1].employeeCd).toBe(true);
      }
    });
  });

  describe("count", () => {
    beforeEach(async () => {
      // テストデータを作成
      await prisma.employee.createMany({
        data: [
          {
            id: createId(),
            employeeCd: "EMP999901",
            email: "count1@example.com",
            name: "カウント1",
            passwordHash: "hashed_password",
            role: Role.USER,
            failedLoginAttempts: 0,
          },
          {
            id: createId(),
            employeeCd: "EMP999902",
            email: "count2@example.com",
            name: "カウント2",
            passwordHash: "hashed_password",
            role: Role.USER,
            failedLoginAttempts: 0,
          },
          {
            id: createId(),
            employeeCd: "EMP999903",
            email: "count3@example.com",
            name: "カウント3",
            passwordHash: "hashed_password",
            role: Role.ADMIN,
            failedLoginAttempts: 0,
          },
        ],
      });
    });

    it("全従業員数をカウントできる", async () => {
      const count = await queryService.count({});

      expect(count).toBeGreaterThanOrEqual(3);
    });

    it("条件に一致する従業員数をカウントできる", async () => {
      const count = await queryService.count({ role: Role.USER });

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("条件に一致する従業員がいない場合は0を返す", async () => {
      const count = await queryService.count({ name: "存在しない名前" });

      expect(count).toBe(0);
    });
  });
});
