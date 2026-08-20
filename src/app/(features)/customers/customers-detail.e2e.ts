import { expect, test } from "@playwright/test";

test.describe("得意先詳細", () => {
  test("パンくずリンクから一覧に戻れる", async ({ page }) => {
    await page.goto("/customers/C001");

    const breadcrumb = page.getByRole("link", { name: "← 得意先一覧に戻る" });
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();

    await expect(page).toHaveURL(/\/customers$/, { timeout: 10000 });
  });

  test("配下の納品先リンクから遷移できる", async ({ page }) => {
    await page.goto("/customers/C001");
    await expect(page.getByRole("heading", { name: "得意先編集" })).toBeVisible();

    // 納品先テーブルにD001リンクが表示されること
    const dlLink = page.getByRole("link", { name: "D001" });
    await expect(dlLink).toBeVisible();

    // D001リンクをクリックして納品先画面に遷移
    await dlLink.click();
    await expect(page).toHaveURL(/\/delivery-locations\/D001/, { timeout: 10000 });
  });

  test("存在しない得意先コードで404が表示される", async ({ page }) => {
    const response = await page.goto("/customers/NONEXIST");
    expect(response?.status()).toBe(404);
  });
});
