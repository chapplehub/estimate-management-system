import { expect, test } from "@playwright/test";

/** テストで使用する固定の従業員データ（seed範囲 EMP000001〜EMP002000 外） */
const TEST_EMPLOYEE_CD = "EMP099901";
const TEST_EMAIL = "e2e-create-test@example.com";

test.describe("従業員新規作成（管理者）", () => {
  test.describe("データ作成テスト", () => {
    // 暫定対応: テストで作成した従業員をUIから削除する（#157 で改善予定）
    test.afterEach(async ({ page }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE_CD}`);
      const deleteButton = page.getByRole("button", { name: "削除" });
      if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteButton.click();
        await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
      }
    });

    test("管理者が新規従業員を作成できる", async ({ page }) => {
      // 一覧画面から新規登録画面に遷移
      await page.goto("/employees");
      await page.getByRole("link", { name: "新規登録" }).click();
      await expect(page).toHaveURL("/employees/new", { timeout: 10000 });
      await expect(page.getByRole("heading", { name: "新規従業員登録" })).toBeVisible();

      // フォーム入力
      await page.getByLabel("名前").fill("E2Eテスト従業員");
      await page.getByLabel("メールアドレス").fill(TEST_EMAIL);
      await page.getByLabel("従業員コード").fill(TEST_EMPLOYEE_CD);
      await page.getByLabel("所属部署").selectOption({ index: 1 }); // 最初の部署を選択
      await page.getByLabel("パスワード").fill("testpass123");
      // 権限はデフォルト「一般ユーザー」のまま

      // 登録実行
      await page.getByRole("button", { name: "登録" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("従業員を登録しました。")).toBeVisible({ timeout: 10000 });

      // 作成した従業員が検索で見つかる
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("従業員コード").fill(TEST_EMPLOYEE_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`employeeCd=${TEST_EMPLOYEE_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_EMPLOYEE_CD })).toBeVisible();
    });
  });

  test("重複する従業員コードでエラーが表示される", async ({ page }) => {
    await page.goto("/employees/new");

    await page.getByLabel("名前").fill("重複テスト");
    await page.getByLabel("メールアドレス").fill("e2e-duplicate-test@example.com");
    await page.getByLabel("従業員コード").fill("EMP000001"); // 既存の従業員コード
    await page.getByLabel("所属部署").selectOption({ index: 1 });
    await page.getByLabel("パスワード").fill("testpass123");

    await page.getByRole("button", { name: "登録" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/employees\/new/);
  });

  test("キャンセルボタンで一覧に戻れる", async ({ page }) => {
    await page.goto("/employees/new");

    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL(/\/employees$/, { timeout: 10000 });
  });
});

test.describe("従業員新規作成（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーは新規作成画面にアクセスできない", async ({ page }) => {
    await page.goto("/employees/new");

    // 権限がないため /signin にリダイレクトされる
    await expect(page).toHaveURL(/\/signin\?reason=forbidden/, { timeout: 10000 });
  });
});
