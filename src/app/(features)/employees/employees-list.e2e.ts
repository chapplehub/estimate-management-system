import { type Page, expect, test } from "@playwright/test";

/**
 * 一覧画面のハイドレーション完了を待つ。
 * SearchForm（"use client"）の onSubmit が機能するには React のハイドレーションが必要。
 * DataTable の行が表示された時点で、ページ全体がインタラクティブになっていると判断する。
 */
async function waitForListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "従業員管理" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

test.describe("従業員一覧（管理者）", () => {
  test("一覧が表示され、管理者には「新規登録」ボタンが見える", async ({ page }) => {
    await page.goto("/employees");
    await waitForListReady(page);

    await expect(page.getByRole("heading", { name: "従業員管理" })).toBeVisible();
    await expect(page.getByRole("link", { name: "新規登録" })).toBeVisible();

    // DataTableに行が表示されていること
    await expect(page.getByRole("heading", { name: "従業員一覧" })).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("メールアドレスで検索（部分一致）できる", async ({ page }) => {
    await page.goto("/employees");
    await waitForListReady(page);

    await page.getByLabel("メールアドレス").fill("employee1");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/email=employee1/, { timeout: 10000 });
    await expect(page.getByText("employee1@example.com")).toBeVisible();
  });

  test("従業員コードで検索（完全一致）できる", async ({ page }) => {
    await page.goto("/employees");
    await waitForListReady(page);

    await page.getByLabel("従業員コード").fill("EMP000001");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/employeeCd=EMP000001/, { timeout: 10000 });
    // 検索結果が1行のみ表示されること
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole("link", { name: "EMP000001" })).toBeVisible();
  });

  test("権限で検索できる", async ({ page }) => {
    await page.goto("/employees");
    await waitForListReady(page);

    await page.getByLabel("権限").selectOption("admin");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/role=admin/, { timeout: 10000 });
    // 表示されている権限バッジがすべて「管理者」であること
    // ヘッダー名からカラム位置を動的に特定（カラム追加・並び替えに耐性を持たせる）
    const headers = await page.locator("table thead th").allTextContents();
    const roleColIndex = headers.indexOf("権限") + 1;
    const roleCells = page.locator(`table tbody tr td:nth-child(${roleColIndex}) span`);
    const count = await roleCells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(roleCells.nth(i)).toHaveText("管理者");
    }
  });

  test("クリアボタンで検索条件がリセットされる", async ({ page }) => {
    await page.goto("/employees?email=employee1");
    await waitForListReady(page);

    // 検索フィールドにデフォルト値が入っていること
    await expect(page.getByLabel("メールアドレス")).toHaveValue("employee1");

    await page.getByRole("button", { name: "クリア" }).click();

    await expect(page).toHaveURL(/\/employees$/, { timeout: 10000 });
    await expect(page.getByLabel("メールアドレス")).toHaveValue("");
  });

  test("従業員コードリンクから詳細画面に遷移できる", async ({ page }) => {
    await page.goto("/employees?employeeCd=EMP000001");
    await waitForListReady(page);

    await page.getByRole("link", { name: "EMP000001" }).click();

    await expect(page).toHaveURL(/\/employees\/EMP000001/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "従業員管理" })).toBeVisible();
  });
});

test.describe("従業員一覧（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーには「新規登録」ボタンが見えない", async ({ page }) => {
    await page.goto("/employees");

    await expect(page.getByRole("heading", { name: "従業員管理" })).toBeVisible();
    // DataTableの行は表示される
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    // 「新規登録」リンクは表示されない
    await expect(page.getByRole("link", { name: "新規登録" })).not.toBeVisible();
  });
});
