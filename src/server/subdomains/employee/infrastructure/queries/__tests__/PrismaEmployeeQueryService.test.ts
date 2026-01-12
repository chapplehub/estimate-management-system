import { createId } from "@paralleldrive/cuid2";
import prisma from "@server/prisma";
import type { UserRole } from "@server/shared/auth/types";
import { USER_ROLES } from "@server/shared/auth/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaEmployeeQueryService } from "../PrismaEmployeeQueryService";

describe("PrismaEmployeeQueryService", () => {
  let queryService: PrismaEmployeeQueryService;

  // テスト用のEmployee/User IDを保持
  const testEmployeeIds: string[] = [];
  const testUserIds: string[] = [];

  /**
   * テスト用のEmployee + Userを作成するヘルパー
   */
  async function createTestEmployeeWithUser(data: {
    employeeCd: string;
    email: string;
    name: string;
    role: UserRole;
    departmentId?: string;
  }) {
    const employeeId = createId();
    const userId = createId();

    // Employeeを作成
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeCd: data.employeeCd,
        email: data.email,
        name: data.name,
        departmentId: data.departmentId ?? "dept-001",
      },
    });

    // Userを作成（Employeeにリンク）
    await prisma.user.create({
      data: {
        id: userId,
        email: data.email,
        name: data.name,
        employeeId: employeeId,
        role: data.role,
      },
    });

    testEmployeeIds.push(employeeId);
    testUserIds.push(userId);

    return { employeeId, userId };
  }

  beforeEach(async () => {
    queryService = new PrismaEmployeeQueryService();
    testEmployeeIds.length = 0;
    testUserIds.length = 0;

    // テストデータのクリーンアップ
    await prisma.user.deleteMany({
      where: {
        employee: {
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
      },
    });
    await prisma.employee.deleteMany({
      where: {
        employeeCd: {
          in: ["EMP999901", "EMP999902", "EMP999903", "EMP999904", "EMP999905"],
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
    // テストデータのクリーンアップ（Userを先に削除）
    await prisma.user.deleteMany({
      where: {
        id: { in: testUserIds },
      },
    });
    await prisma.employee.deleteMany({
      where: {
        id: { in: testEmployeeIds },
      },
    });
  });

  describe("findById", () => {
    it("IDで従業員を取得できる", async () => {
      // テストデータを作成
      const { employeeId } = await createTestEmployeeWithUser({
        employeeCd: "EMP999901",
        email: "query-findbyid@example.com",
        name: "QueryFindById",
        role: USER_ROLES.USER,
      });

      // findByIdで取得
      const found = await queryService.findById(employeeId);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(employeeId);
      expect(found?.employeeCd).toBe("EMP999901");
      expect(found?.email).toBe("query-findbyid@example.com");
      expect(found?.name).toBe("QueryFindById");
      expect(found?.role).toBe(USER_ROLES.USER);
    });

    it("存在しないIDの場合nullを返す", async () => {
      const found = await queryService.findById("non-existent-id");
      expect(found).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("メールアドレスで従業員を取得できる", async () => {
      await createTestEmployeeWithUser({
        employeeCd: "EMP999902",
        email: "query-email@example.com",
        name: "QueryEmail",
        role: USER_ROLES.ADMIN,
      });

      const found = await queryService.findByEmail("query-email@example.com");

      expect(found).not.toBeNull();
      expect(found?.email).toBe("query-email@example.com");
      expect(found?.employeeCd).toBe("EMP999902");
      expect(found?.role).toBe(USER_ROLES.ADMIN);
    });

    it("存在しないメールアドレスの場合nullを返す", async () => {
      const found = await queryService.findByEmail("nonexistent@example.com");
      expect(found).toBeNull();
    });
  });

  describe("findByEmployeeCd", () => {
    it("従業員CDで従業員を取得できる", async () => {
      await createTestEmployeeWithUser({
        employeeCd: "EMP999903",
        email: "query-cd@example.com",
        name: "QueryEmployeeCd",
        role: USER_ROLES.USER,
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
      // TODO:seed.tsで使ってる苗字と被ってるからテストが失敗してる。
      await createTestEmployeeWithUser({
        employeeCd: "EMP999901",
        email: "search-tanaka@example.com",
        name: "田中太郎",
        role: USER_ROLES.USER,
      });
      await createTestEmployeeWithUser({
        employeeCd: "EMP999902",
        email: "search-yamada@example.com",
        name: "山田花子",
        role: USER_ROLES.ADMIN,
      });
      await createTestEmployeeWithUser({
        employeeCd: "EMP999903",
        email: "search-suzuki@example.com",
        name: "鈴木一郎",
        role: USER_ROLES.USER,
      });
      await createTestEmployeeWithUser({
        employeeCd: "EMP999904",
        email: "search-sato@example.com",
        name: "佐藤次郎",
        role: USER_ROLES.USER,
      });
    });

    it("名前での部分一致検索ができる", async () => {
      const results = await queryService.search({ name: "田中" });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("田中太郎");
    });

    it("メールアドレスでの部分一致検索ができる", async () => {
      const results = await queryService.search({ email: "search-yamada" });

      expect(results.length).toBe(1);
      expect(results[0].email).toBe("search-yamada@example.com");
    });

    it("従業員CDでの完全一致検索ができる", async () => {
      const results = await queryService.search({ employeeCd: "EMP999902" });

      expect(results.length).toBe(1);
      expect(results[0].employeeCd).toBe("EMP999902");
    });

    it("ロールでのフィルタができる", async () => {
      const results = await queryService.search({ role: USER_ROLES.ADMIN });

      // 少なくとも1人のadminが取得できる
      expect(results.length).toBeGreaterThanOrEqual(1);
      // 全員がadminであること
      results.forEach((r) => {
        expect(r.role).toBe(USER_ROLES.ADMIN);
      });
      // テストデータの山田花子が含まれている
      const names = results.map((r) => r.name);
      expect(names).toContain("山田花子");
    });

    // NOTE: isLocked 検索は認証を better-auth に移行したため削除

    it("複数条件の組み合わせで検索できる", async () => {
      const results = await queryService.search({
        role: USER_ROLES.USER,
        name: "田中",
      });

      // user かつ 田中 が名前に含まれる従業員
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((r) => {
        expect(r.role).toBe(USER_ROLES.USER);
        expect(r.name).toContain("田中");
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
      await createTestEmployeeWithUser({
        employeeCd: "EMP999901",
        email: "findall1@example.com",
        name: "全取得1",
        role: USER_ROLES.USER,
      });
      await createTestEmployeeWithUser({
        employeeCd: "EMP999902",
        email: "findall2@example.com",
        name: "全取得2",
        role: USER_ROLES.ADMIN,
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
      await createTestEmployeeWithUser({
        employeeCd: "EMP999901",
        email: "count1@example.com",
        name: "カウント1",
        role: USER_ROLES.USER,
      });
      await createTestEmployeeWithUser({
        employeeCd: "EMP999902",
        email: "count2@example.com",
        name: "カウント2",
        role: USER_ROLES.USER,
      });
      await createTestEmployeeWithUser({
        employeeCd: "EMP999903",
        email: "count3@example.com",
        name: "カウント3",
        role: USER_ROLES.ADMIN,
      });
    });

    it("全従業員数をカウントできる", async () => {
      const count = await queryService.count({});

      expect(count).toBeGreaterThanOrEqual(3);
    });

    it("条件に一致する従業員数をカウントできる", async () => {
      const count = await queryService.count({ role: USER_ROLES.USER });

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("条件に一致する従業員がいない場合は0を返す", async () => {
      const count = await queryService.count({ name: "存在しない名前" });

      expect(count).toBe(0);
    });
  });
});
