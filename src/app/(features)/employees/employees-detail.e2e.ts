import { expect, test } from "@playwright/test";
import { prisma } from "../../../../e2e-helpers/prisma";
import { generateId } from "../../../../src/server/shared/generateId";

/** 削除テストで使用する固定の従業員データ（seed範囲外） */
const DELETE_TEST_EMPLOYEE_CD = "EMP099902";
const DELETE_TEST_EMAIL = "e2e-detail-delete@example.com";

test.describe("従業員詳細・編集・削除（管理者）", () => {
  test.describe("更新テスト", () => {
    test.afterEach(async () => {
      // シードデータの名前を復元（EMP000010: 中村 直樹）
      await prisma.employee.update({
        where: { employeeCd: "EMP000010" },
        data: { name: "中村 直樹" },
      });
    });

    test("管理者が従業員情報を更新できる", async ({ page }) => {
      await page.goto("/employees/EMP000010");

      // 編集モードで表示されること
      await expect(page.getByRole("heading", { name: "従業員管理" })).toBeVisible();
      await expect(page.getByText("従業員変更")).toBeVisible();

      // 従業員コードが読み取り専用であること
      await expect(page.locator("#employeeCd-display")).toBeDisabled();

      // 名前を変更して更新
      const nameField = page.getByLabel("名前");
      await nameField.clear();
      await nameField.fill("E2E更新テスト");
      await page.getByRole("button", { name: "更新" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("従業員情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // 変更が反映されていること
      await expect(nameField).toHaveValue("E2E更新テスト");
    });
  });

  test("管理者には削除ボタンが表示される", async ({ page }) => {
    await page.goto("/employees/EMP000003");

    await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
  });

  test.describe("削除テスト", () => {
    test.beforeEach(async () => {
      // Prismaで削除テスト用従業員をDB直接作成（Employee + User + Account）
      const employeeId = generateId();
      const userId = generateId();
      const accountId = generateId();
      // シードデータの部署（DEPT001: 営業部）のIDを取得
      const department = await prisma.department.findFirstOrThrow({
        where: { departmentCd: "DEPT001" },
      });

      await prisma.$transaction(async (tx) => {
        await tx.employee.create({
          data: {
            id: employeeId,
            employeeCd: DELETE_TEST_EMPLOYEE_CD,
            email: DELETE_TEST_EMAIL,
            name: "削除テスト従業員",
            departmentId: department.id,
          },
        });
        await tx.user.create({
          data: {
            id: userId,
            name: "削除テスト従業員",
            email: DELETE_TEST_EMAIL,
            emailVerified: true,
            employeeId: employeeId,
            role: "user",
          },
        });
        await tx.account.create({
          data: {
            id: accountId,
            accountId: userId,
            providerId: "credential",
            userId: userId,
            password: "dummy-not-used-for-login",
          },
        });
      });
    });

    test.afterEach(async () => {
      // FK制約順にクリーンアップ: Account → User → Employee
      await prisma.account.deleteMany({ where: { user: { email: DELETE_TEST_EMAIL } } });
      await prisma.user.deleteMany({ where: { email: DELETE_TEST_EMAIL } });
      await prisma.employee.deleteMany({ where: { employeeCd: DELETE_TEST_EMPLOYEE_CD } });
    });

    test("管理者が従業員を削除できる", async ({ page }) => {
      // 作成した従業員の詳細画面に遷移
      await page.goto(`/employees/${DELETE_TEST_EMPLOYEE_CD}`);
      await expect(page.getByText("従業員変更")).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
      await expect(page.getByText("従業員を削除しました。")).toBeVisible({ timeout: 10000 });

      // 削除した従業員が検索で見つからない
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("従業員コード").fill(DELETE_TEST_EMPLOYEE_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`employeeCd=${DELETE_TEST_EMPLOYEE_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: DELETE_TEST_EMPLOYEE_CD })).not.toBeVisible();
    });
  });

  test("存在しない従業員コードで404が表示される", async ({ page }) => {
    await page.goto("/employees/EMP999999");

    // 404ページが表示されること
    await expect(page.getByText("404")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("従業員詳細（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("本人は自分の情報を編集できる（owner権限）", async ({ page }) => {
    // employee2 (EMP000002) は user 認証のアカウント
    await page.goto("/employees/EMP000002");

    await expect(page.getByText("従業員変更")).toBeVisible();
    // フィールドが有効（disabled でない）
    await expect(page.getByLabel("名前")).toBeEnabled();
    await expect(page.getByLabel("メールアドレス")).toBeEnabled();
    // 更新ボタンが表示される
    await expect(page.getByRole("button", { name: "更新" })).toBeVisible();
  });

  test("一般ユーザーは他人の情報を閲覧のみ", async ({ page }) => {
    await page.goto("/employees/EMP000003");

    // 閲覧モードで表示されること
    await expect(page.getByText("従業員詳細")).toBeVisible();
    // フィールドが無効（disabled）
    await expect(page.getByLabel("名前")).toBeDisabled();
    await expect(page.getByLabel("メールアドレス")).toBeDisabled();
    // 更新ボタンが表示されない
    await expect(page.getByRole("button", { name: "更新" })).not.toBeVisible();
    // 削除ボタンが表示されない
    await expect(page.getByRole("button", { name: "削除" })).not.toBeVisible();
  });
});
