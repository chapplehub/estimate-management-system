import { expect, test } from "@playwright/test";

/** テストで使用する固定の従業員データ（seed範囲 EMP000001〜EMP002000 外） */
const TEST_EMPLOYEE_CD = "EMP099902";
const TEST_EMAIL = "e2e-detail-test@example.com";

/**
 * テスト用従業員を新規作成画面から作成し、一覧にリダイレクトされるまで待つ。
 */
async function createTestEmployee(
  page: import("@playwright/test").Page,
  data: { employeeCd: string; email: string; name: string }
) {
  await page.goto("/employees/new");
  await expect(page.getByRole("heading", { name: "新規従業員登録" })).toBeVisible();
  await page.getByLabel("名前").fill(data.name);
  await page.getByLabel("メールアドレス").fill(data.email);
  await page.getByLabel("従業員コード").fill(data.employeeCd);
  await page.getByLabel("所属部署").selectOption({ index: 1 });
  await page.getByLabel("パスワード").fill("testpass123");
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
}

test.describe("従業員詳細・編集・削除（管理者）", () => {
  test("管理者が従業員情報を更新できる", async ({ page }) => {
    await page.goto("/employees/EMP000050");

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

  test("管理者には削除ボタンが表示される", async ({ page }) => {
    await page.goto("/employees/EMP000003");

    await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
  });

  test.describe("削除テスト", () => {
    // 暫定対応: テスト用従業員をUIから作成する（#157 で改善予定）
    test.beforeEach(async ({ page }) => {
      await createTestEmployee(page, {
        employeeCd: TEST_EMPLOYEE_CD,
        email: TEST_EMAIL,
        name: "削除テスト従業員",
      });
    });

    test("管理者が従業員を削除できる", async ({ page }) => {
      // 作成した従業員の詳細画面に遷移
      await page.goto(`/employees/${TEST_EMPLOYEE_CD}`);
      await expect(page.getByText("従業員変更")).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
      await expect(page.getByText("従業員を削除しました。")).toBeVisible({ timeout: 10000 });

      // 削除した従業員が検索で見つからない
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("従業員コード").fill(TEST_EMPLOYEE_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`employeeCd=${TEST_EMPLOYEE_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_EMPLOYEE_CD })).not.toBeVisible();
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
