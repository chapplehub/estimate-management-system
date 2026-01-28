import { test, expect } from "@playwright/test";

test.describe("ログアウト", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test("ログアウトに成功する", async ({ page }) => {
    // ログイン状態で従業員一覧ページにアクセス
    await page.goto("/employees");

    // サインアウトボタンをクリック
    await page.getByRole("button", { name: "サインアウト" }).click();

    // /signin にリダイレクトされることを確認
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });
});
