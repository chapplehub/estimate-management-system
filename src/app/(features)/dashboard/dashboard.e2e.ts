import { test, expect } from "@playwright/test";

test.describe("ダッシュボード", () => {
  test("ダッシュボードが正しく表示され、従業員管理に遷移できる", async ({ page }) => {
    await page.goto("/dashboard");

    // ダッシュボードの表示を確認
    await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible();
    await expect(page.getByRole("link", { name: "従業員管理" })).toBeVisible();

    // 従業員管理リンクをクリックして遷移を確認
    await page.getByRole("link", { name: "従業員管理" }).click();
    await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "従業員管理" })).toBeVisible();
  });

  test("共通販売単価管理に遷移できる", async ({ page }) => {
    await page.goto("/dashboard");

    // 共通販売単価管理リンクの表示を確認
    await expect(page.getByRole("link", { name: "共通販売単価管理" })).toBeVisible();

    // 共通販売単価管理リンクをクリックして遷移を確認
    await page.getByRole("link", { name: "共通販売単価管理" }).click();
    await expect(page).toHaveURL(/\/common-selling-prices/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "共通販売単価", exact: true })).toBeVisible();
  });
});

test.describe("ダッシュボード（未認証）", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("未認証で /dashboard にアクセスすると /signin にリダイレクトされる", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });
});
