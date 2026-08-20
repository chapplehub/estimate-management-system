import { expect, test } from "@playwright/test";

test.describe("納品先詳細", () => {
  test("パンくずリンクから一覧に戻れる", async ({ page }) => {
    await page.goto("/delivery-locations/D001");

    const breadcrumb = page.getByRole("link", { name: "← 納品先一覧に戻る" });
    await expect(breadcrumb).toBeVisible();
    await breadcrumb.click();

    await expect(page).toHaveURL(/\/delivery-locations$/, { timeout: 10000 });
  });

  test("親得意先リンクから得意先画面に遷移できる", async ({ page }) => {
    await page.goto("/delivery-locations/D001");
    await expect(page.getByRole("heading", { name: "納品先編集" })).toBeVisible();

    // 親得意先リンクが表示されること
    const customerLink = page.getByRole("link", { name: "株式会社山田製作所" });
    await expect(customerLink).toBeVisible();

    // 得意先画面に遷移できること
    await customerLink.click();
    await expect(page).toHaveURL(/\/customers\/C001/, { timeout: 10000 });
  });

  test("存在しない納品先コードで404が表示される", async ({ page }) => {
    const response = await page.goto("/delivery-locations/NONEXIST");
    expect(response?.status()).toBe(404);
  });
});
