import { type Page, expect, test } from "@playwright/test";

/**
 * 一覧画面のハイドレーション完了を待つ。
 * SearchForm（"use client"）の onSubmit が機能するには React のハイドレーションが必要。
 * DataTable の行が表示された時点で、ページ全体がインタラクティブになっていると判断する。
 */
async function waitForListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "部署管理" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

/** ヘッダー名からカラム位置（1始まり）を取得する */
async function getColumnIndex(page: Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}

test.describe("部署一覧（管理者）", () => {
  test("一覧が表示され、管理者には「新規登録」ボタンが見える", async ({ page }) => {
    await page.goto("/departments");
    await waitForListReady(page);

    await expect(page.getByRole("heading", { name: "部署管理" })).toBeVisible();
    await expect(page.getByRole("link", { name: "新規登録" })).toBeVisible();

    // DataTableに行が表示されていること
    await expect(page.getByRole("heading", { name: "部署一覧" })).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("部署名で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/departments");
    await waitForListReady(page);

    await page.getByLabel("部署名").fill("営業");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/name=/, { timeout: 10000 });
    await expect(page.getByText("営業部")).toBeVisible();
  });

  test("略称で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/departments");
    await waitForListReady(page);

    await page.getByLabel("略称").fill("営業");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/abbreviation=/, { timeout: 10000 });
    await expect(page.getByText("営業部")).toBeVisible();
  });

  test("部署コードで検索（完全一致）できる", async ({ page }) => {
    await page.goto("/departments");
    await waitForListReady(page);

    await page.getByLabel("部署コード").fill("DEPT001");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/departmentCd=DEPT001/, { timeout: 10000 });
    // 検索結果が1行のみ表示されること
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole("link", { name: "DEPT001" })).toBeVisible();
  });

  test("状態で検索できる", async ({ page }) => {
    await page.goto("/departments");
    await waitForListReady(page);

    await page.getByLabel("状態").selectOption("true");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/isActive=true/, { timeout: 10000 });
    // 表示されている状態バッジがすべて「有効」であること
    const statusCol = await getColumnIndex(page, "状態");
    const statusCells = page.locator(`table tbody tr td:nth-child(${statusCol}) span`);
    const count = await statusCells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(statusCells.nth(i)).toHaveText("有効");
    }
  });

  test("クリアボタンで検索条件がリセットされる", async ({ page }) => {
    await page.goto("/departments?name=%E5%96%B6%E6%A5%AD");
    await waitForListReady(page);

    // 検索フィールドにデフォルト値が入っていること
    await expect(page.getByLabel("部署名")).toHaveValue("営業");

    await page.getByRole("button", { name: "クリア" }).click();

    await expect(page).toHaveURL(/\/departments$/, { timeout: 10000 });
    await expect(page.getByLabel("部署名")).toHaveValue("");
  });

  test("部署コードリンクから詳細画面に遷移できる", async ({ page }) => {
    await page.goto("/departments?departmentCd=DEPT001");
    await waitForListReady(page);

    await page.getByRole("link", { name: "DEPT001" }).click();

    await expect(page).toHaveURL(/\/departments\/DEPT001/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "部署管理" })).toBeVisible();
  });
});

test.describe("部署一覧（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーには「新規登録」ボタンが見えない", async ({ page }) => {
    await page.goto("/departments");

    await expect(page.getByRole("heading", { name: "部署管理" })).toBeVisible();
    // DataTableの行は表示される
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    // 「新規登録」リンクは表示されない
    await expect(page.getByRole("link", { name: "新規登録" })).not.toBeVisible();
  });
});
