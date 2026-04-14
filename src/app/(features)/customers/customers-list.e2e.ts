import { expect, test } from "@playwright/test";

/**
 * 一覧画面のハイドレーション完了を待つ。
 * SearchForm（"use client"）の onSubmit が機能するには React のハイドレーションが必要。
 * DataTable の行が表示された時点で、ページ全体がインタラクティブになっていると判断する。
 */
async function waitForListReady(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "得意先管理" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

test.describe("得意先一覧（管理者）", () => {
  test("一覧が表示される", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await expect(page.getByRole("heading", { name: "得意先管理" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "得意先一覧" })).toBeVisible();

    // DataTableに行が表示されていること
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();

    // 得意先管理画面には「新規登録」ボタンは存在しない
    await expect(page.getByRole("link", { name: "新規登録" })).not.toBeVisible();
  });

  test("名前で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("名前").fill("山田");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/name=/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "C001" })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("コードで検索（完全一致）できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("コード").fill("C001");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/code=C001/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "C001" })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("郵便番号で検索（完全一致）できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("郵便番号").fill("1000001");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/postalCode=1000001/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "C001" })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("都道府県で検索できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("都道府県").selectOption("東京都");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/prefecture=/, { timeout: 10000 });

    // 表示されている都道府県がすべて「東京都」であること
    const prefectureCells = page.locator("table tbody tr td:nth-child(4)");
    const count = await prefectureCells.count();
    expect(count).toBe(2);
    for (let i = 0; i < count; i++) {
      await expect(prefectureCells.nth(i)).toHaveText("東京都");
    }
  });

  test("住所で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("住所").fill("梅田");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/address=/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "C003" })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("電話番号で検索（完全一致）できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("電話番号").fill("0312345678");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/phoneNumber=0312345678/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "C001" })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("FAX番号で検索（完全一致）できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("FAX番号").fill("0661234568");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/faxNumber=0661234568/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "C003" })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("担当者で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("担当者").fill("田中");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/contactPerson=/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "C003" })).toBeVisible();

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("状態「有効」で検索できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("状態").selectOption("true");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/isActive=true/, { timeout: 10000 });

    // 表示されている状態バッジがすべて「有効」であること
    const statusBadges = page.locator("table tbody tr td:nth-child(10) span");
    const count = await statusBadges.count();
    expect(count).toBe(4);
    for (let i = 0; i < count; i++) {
      await expect(statusBadges.nth(i)).toHaveText("有効");
    }
  });

  test("状態「無効」で検索できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("状態").selectOption("false");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/isActive=false/, { timeout: 10000 });

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole("link", { name: "C004" })).toBeVisible();

    // 状態バッジが「無効」であること
    const statusBadge = page.locator("table tbody tr td:nth-child(10) span");
    await expect(statusBadge).toHaveText("無効");
  });

  test("複数条件を組み合わせて検索できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByLabel("名前").fill("電子");
    await page.getByLabel("都道府県").selectOption("東京都");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/name=/, { timeout: 10000 });
    await expect(page).toHaveURL(/prefecture=/);

    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole("link", { name: "C002" })).toBeVisible();
  });

  test("クリアボタンで検索条件がリセットされる", async ({ page }) => {
    await page.goto("/customers?name=%E5%B1%B1%E7%94%B0");
    await waitForListReady(page);

    // 検索フィールドにデフォルト値が入っていること
    await expect(page.getByLabel("名前")).toHaveValue("山田");

    await page.getByRole("button", { name: "クリア" }).click();

    await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });
    await expect(page.getByLabel("名前")).toHaveValue("");
  });

  test("コードリンクから詳細画面に遷移できる", async ({ page }) => {
    await page.goto("/customers");
    await waitForListReady(page);

    await page.getByRole("link", { name: "C001" }).click();

    await expect(page).toHaveURL(/\/customers\/C001/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "得意先管理" })).toBeVisible();
  });
});

test.describe("得意先一覧（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーでも得意先一覧を閲覧できる", async ({ page }) => {
    await page.goto("/customers");

    await expect(page.getByRole("heading", { name: "得意先管理" })).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });
});
