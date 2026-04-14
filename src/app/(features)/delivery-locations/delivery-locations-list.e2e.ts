import { expect, test } from "@playwright/test";

/**
 * 一覧画面のハイドレーション完了を待つ。
 * SearchForm（"use client"）の onSubmit が機能するには React のハイドレーションが必要。
 * DataTable の行が表示された時点で、ページ全体がインタラクティブになっていると判断する。
 */
async function waitForListReady(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "納品先管理" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

/** ヘッダー名からカラム位置（1始まり）を取得する */
async function getColumnIndex(page: import("@playwright/test").Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}

test.describe("納品先一覧（管理者）", () => {
  test("一覧が表示される", async ({ page }) => {
    await page.goto("/delivery-locations");
    await waitForListReady(page);

    await expect(page.getByRole("heading", { name: "納品先管理" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "納品先一覧" })).toBeVisible();

    // DataTableに行が表示されていること
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();

    // 納品先管理画面には「新規登録」ボタンは存在しない
    await expect(page.getByRole("link", { name: "新規登録" })).not.toBeVisible();
  });

  test("名前で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/delivery-locations");
    await waitForListReady(page);

    await page.getByLabel("名前").fill("山田");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/name=/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "D001" })).toBeVisible();
    await expect(page.getByRole("link", { name: "D002" })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2);
  });

  test("コードで検索（完全一致）できる", async ({ page }) => {
    await page.goto("/delivery-locations");
    await waitForListReady(page);

    await page.getByLabel("コード").fill("D003");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/code=D003/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "D003" })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("得意先で検索できる", async ({ page }) => {
    await page.goto("/delivery-locations");
    await waitForListReady(page);

    await page.getByLabel("得意先").selectOption({ label: "株式会社山田製作所" });
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/customerId=/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "D001" })).toBeVisible();
    await expect(page.getByRole("link", { name: "D002" })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2);
  });

  test("状態「有効」で検索できる", async ({ page }) => {
    await page.goto("/delivery-locations");
    await waitForListReady(page);

    await page.getByLabel("状態").selectOption("true");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/isActive=true/, { timeout: 10000 });

    // 表示されている状態バッジがすべて「有効」であること
    const statusCol = await getColumnIndex(page, "状態");
    const statusBadges = page.locator(`table tbody tr td:nth-child(${statusCol}) span`);
    const count = await statusBadges.count();
    expect(count).toBe(6);
    for (let i = 0; i < count; i++) {
      await expect(statusBadges.nth(i)).toHaveText("有効");
    }
  });

  test("状態「無効」で検索できる", async ({ page }) => {
    await page.goto("/delivery-locations");
    await waitForListReady(page);

    await page.getByLabel("状態").selectOption("false");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/isActive=false/, { timeout: 10000 });

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole("link", { name: "D007" })).toBeVisible();

    // 状態バッジが「無効」であること
    const statusCol = await getColumnIndex(page, "状態");
    const statusBadge = page.locator(`table tbody tr td:nth-child(${statusCol}) span`);
    await expect(statusBadge).toHaveText("無効");
  });

  test("複数条件を組み合わせて検索できる", async ({ page }) => {
    await page.goto("/delivery-locations");
    await waitForListReady(page);

    await page.getByLabel("名前").fill("大阪");
    await page.getByLabel("状態").selectOption("true");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/name=/, { timeout: 10000 });
    await expect(page).toHaveURL(/isActive=true/);

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(page.getByRole("link", { name: "D004" })).toBeVisible();
    await expect(page.getByRole("link", { name: "D005" })).toBeVisible();
  });

  test("クリアボタンで検索条件がリセットされる", async ({ page }) => {
    await page.goto("/delivery-locations?name=%E5%B1%B1%E7%94%B0");
    await waitForListReady(page);

    // 検索フィールドにデフォルト値が入っていること
    await expect(page.getByLabel("名前")).toHaveValue("山田");

    await page.getByRole("button", { name: "クリア" }).click();

    await expect(page).toHaveURL(/\/delivery-locations$/, { timeout: 10000 });
    await expect(page.getByLabel("名前")).toHaveValue("");
  });

  test("コードリンクから詳細画面に遷移できる", async ({ page }) => {
    await page.goto("/delivery-locations");
    await waitForListReady(page);

    await page.getByRole("link", { name: "D001" }).click();

    await expect(page).toHaveURL(/\/delivery-locations\/D001/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "納品先管理" })).toBeVisible();
  });

  test("得意先リンクのhrefが正しい", async ({ page }) => {
    await page.goto("/delivery-locations");
    await waitForListReady(page);

    // 先頭行（D001）の得意先カラムのリンクを検証
    const customerCol = await getColumnIndex(page, "得意先");
    const customerLink = page.locator(`table tbody tr:first-child td:nth-child(${customerCol}) a`);
    await expect(customerLink).toHaveAttribute("href", "/customers/C001");
  });
});

test.describe("納品先一覧（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーでも納品先一覧を閲覧できる", async ({ page }) => {
    await page.goto("/delivery-locations");

    await expect(page.getByRole("heading", { name: "納品先管理" })).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });
});
