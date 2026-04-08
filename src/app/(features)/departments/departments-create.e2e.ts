import { expect, test } from "@playwright/test";

/** テストで使用する固定の部署データ（seed範囲 DEPT001〜DEPT005 外） */
const TEST_DEPT_CD = "DEPT901";
const TEST_DEPT_NAME = "E2Eテスト部署";
const TEST_DEPT_ABBR = "E2Eテスト";

test.describe("部署新規作成（管理者）", () => {
  test.describe("データ作成テスト", () => {
    test.afterEach(async ({ page }) => {
      await page.goto(`/departments/${TEST_DEPT_CD}`);
      const deleteButton = page.getByRole("button", { name: "削除" });
      if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deleteButton.click();
        await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
      }
    });

    test("管理者が新規部署を作成できる", async ({ page }) => {
      // 一覧画面から新規登録画面に遷移
      await page.goto("/departments");
      await page.getByRole("link", { name: "新規登録" }).click();
      await expect(page).toHaveURL("/departments/new", { timeout: 10000 });
      await expect(page.getByRole("heading", { name: "新規部署登録" })).toBeVisible();

      // フォーム入力
      await page.getByLabel("部署コード").fill(TEST_DEPT_CD);
      await page.getByLabel("部署名").fill(TEST_DEPT_NAME);
      await page.getByLabel("略称").fill(TEST_DEPT_ABBR);
      // 親部署はオプションのため未選択

      // 登録実行
      await page.getByRole("button", { name: "登録" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("部署を登録しました。")).toBeVisible({ timeout: 10000 });

      // 作成した部署が検索で見つかる
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("部署コード").fill(TEST_DEPT_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`departmentCd=${TEST_DEPT_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_DEPT_CD })).toBeVisible();
    });
  });

  test("重複する部署コードでエラーが表示される", async ({ page }) => {
    await page.goto("/departments/new");

    await page.getByLabel("部署コード").fill("DEPT001"); // 既存の部署コード
    await page.getByLabel("部署名").fill("重複テスト");
    await page.getByLabel("略称").fill("重複");

    await page.getByRole("button", { name: "登録" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/departments\/new/);
  });

  test("キャンセルボタンで一覧に戻れる", async ({ page }) => {
    await page.goto("/departments/new");

    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL(/\/departments$/, { timeout: 10000 });
  });
});

test.describe("部署新規作成（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーは新規作成画面にアクセスできない", async ({ page }) => {
    await page.goto("/departments/new");

    // 権限がないため /signin にリダイレクトされる
    await expect(page).toHaveURL(/\/signin\?reason=forbidden/, { timeout: 10000 });
  });
});
