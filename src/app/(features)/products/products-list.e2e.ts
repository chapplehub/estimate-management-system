import { type Page, expect, test } from "@playwright/test";

/**
 * 一覧画面のハイドレーション完了を待つ。
 * SearchForm（"use client"）の onSubmit が機能するには React のハイドレーションが必要。
 * DataTable の行が表示された時点で、ページ全体がインタラクティブになっていると判断する。
 */
async function waitForListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "商品管理" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

/** ヘッダー名からカラム位置（1始まり）を取得する */
async function getColumnIndex(page: Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}

test.describe("商品一覧（管理者）", () => {
  test("一覧が表示され、管理者には「新規登録」ボタンが見える", async ({ page }) => {
    await page.goto("/products");
    await waitForListReady(page);

    await expect(page.getByRole("heading", { name: "商品管理" })).toBeVisible();
    await expect(page.getByRole("link", { name: "新規登録" })).toBeVisible();

    // DataTableに行が表示されていること
    await expect(page.getByRole("heading", { name: "商品一覧" })).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("商品コードで検索（部分一致）できる", async ({ page }) => {
    await page.goto("/products");
    await waitForListReady(page);

    await page.getByLabel("商品コード").fill("PRD001");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/code=PRD001/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD001" })).toBeVisible();
  });

  test("商品名で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/products");
    await waitForListReady(page);

    await page.getByLabel("商品名").fill("デスク");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/name=/, { timeout: 10000 });
    await expect(page.getByText("標準デスク")).toBeVisible();
  });

  test("商品区分で検索できる", async ({ page }) => {
    await page.goto("/products");
    await waitForListReady(page);

    await page.getByLabel("商品区分").selectOption("CONSUMABLE");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/category=CONSUMABLE/, { timeout: 10000 });
    // 表示されている商品区分がすべて「消耗品」であること
    const categoryCol = await getColumnIndex(page, "商品区分");
    const categoryBadges = page.locator(`table tbody tr td:nth-child(${categoryCol}) span`);
    const count = await categoryBadges.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(categoryBadges.nth(i)).toHaveText("消耗品");
    }
  });

  test("状態で検索できる", async ({ page }) => {
    await page.goto("/products");
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
    await page.goto("/products?code=PRD001");
    await waitForListReady(page);

    // 検索フィールドにデフォルト値が入っていること
    await expect(page.getByLabel("商品コード")).toHaveValue("PRD001");

    await page.getByRole("button", { name: "クリア" }).click();

    await expect(page).toHaveURL(/\/products$/, { timeout: 10000 });
    await expect(page.getByLabel("商品コード")).toHaveValue("");
  });
});

test.describe("商品一覧（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーには「新規登録」ボタンが見えない", async ({ page }) => {
    await page.goto("/products");

    await expect(page.getByRole("heading", { name: "商品管理" })).toBeVisible();
    // DataTableの行は表示される
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    // 「新規登録」リンクは表示されない
    await expect(page.getByRole("link", { name: "新規登録" })).not.toBeVisible();
  });
});
