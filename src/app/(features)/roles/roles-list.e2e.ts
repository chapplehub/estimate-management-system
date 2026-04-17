import { type Page, expect, test } from "@playwright/test";

/**
 * 一覧画面のハイドレーション完了を待つ。
 * SearchForm（"use client"）の onSubmit が機能するには React のハイドレーションが必要。
 * DataTable の行が表示された時点で、ページ全体がインタラクティブになっていると判断する。
 */
async function waitForListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "役割管理" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

/** ヘッダー名からカラム位置（1始まり）を取得する */
async function getColumnIndex(page: Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}

test.describe("役割一覧（管理者）", () => {
  test("一覧が表示され、管理者には「新規登録」ボタンが見える", async ({ page }) => {
    await page.goto("/roles");
    await waitForListReady(page);

    await expect(page.getByRole("heading", { name: "役割管理" })).toBeVisible();
    await expect(page.getByRole("link", { name: "新規登録" })).toBeVisible();

    // DataTableに行が表示されていること
    await expect(page.getByRole("heading", { name: "役割一覧" })).toBeVisible();
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
  });

  test("役割名で検索（部分一致）できる", async ({ page }) => {
    await page.goto("/roles");
    await waitForListReady(page);

    await page.getByLabel("役割名").fill("営業");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/name=/, { timeout: 10000 });
    // 表示されている役割名列がすべて「営業」を含むこと
    const nameCol = await getColumnIndex(page, "役割名");
    const nameCells = page.locator(`table tbody tr td:nth-child(${nameCol})`);
    const count = await nameCells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(nameCells.nth(i)).toContainText("営業");
    }
  });

  test("役割コードで検索（完全一致）できる", async ({ page }) => {
    await page.goto("/roles");
    await waitForListReady(page);

    await page.getByLabel("役割コード").fill("ROLE001");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/roleCd=ROLE001/, { timeout: 10000 });
    // 検索結果が1行のみ表示されること
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(page.getByRole("link", { name: "ROLE001" })).toBeVisible();
  });

  test("役職で検索できる", async ({ page }) => {
    await page.goto("/roles");
    await waitForListReady(page);

    await page.getByLabel("役職").selectOption({ label: "課長" });
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/positionId=/, { timeout: 10000 });
    // 表示されている役職列がすべて「課長」であること
    const positionCol = await getColumnIndex(page, "役職");
    const positionCells = page.locator(`table tbody tr td:nth-child(${positionCol})`);
    const count = await positionCells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(positionCells.nth(i)).toHaveText("課長");
    }
  });

  test("クリアボタンで検索条件がリセットされる", async ({ page }) => {
    await page.goto("/roles?name=営業");
    await waitForListReady(page);

    // 検索フィールドにデフォルト値が入っていること
    await expect(page.getByLabel("役割名")).toHaveValue("営業");

    await page.getByRole("button", { name: "クリア" }).click();

    await expect(page).toHaveURL(/\/roles$/, { timeout: 10000 });
    await expect(page.getByLabel("役割名")).toHaveValue("");
  });

  test("役割コードリンクから詳細画面に遷移できる", async ({ page }) => {
    await page.goto("/roles?roleCd=ROLE001");
    await waitForListReady(page);

    await page.getByRole("link", { name: "ROLE001" }).click();

    await expect(page).toHaveURL(/\/roles\/ROLE001/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "役割管理" })).toBeVisible();
  });
});

test.describe("役割一覧（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーには「新規登録」ボタンが見えない", async ({ page }) => {
    await page.goto("/roles");

    await expect(page.getByRole("heading", { name: "役割管理" })).toBeVisible();
    // DataTableの行は表示される
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    // 「新規登録」リンクは表示されない
    await expect(page.getByRole("link", { name: "新規登録" })).not.toBeVisible();
  });
});
