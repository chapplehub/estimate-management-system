import { test, expect } from "@playwright/test";
import { SIGN_IN_REDIRECT_URL } from "../signin/consts";

test.describe("ログアウト", () => {
  // storageStateを使わない（ログアウトはセッションを破壊するため、共有状態に依存すべきでない）

  test("ログアウトに成功する", async ({ page }) => {
    // 1. まずログインする（このテスト専用のセッション）
    await page.goto("/signin");
    await page.getByLabel("メールアドレス").fill("employee1@example.com");
    await page.getByLabel("パスワード").fill("pass123!");
    await page.getByRole("button", { name: "サインイン" }).click();
    await expect(page).toHaveURL(SIGN_IN_REDIRECT_URL, { timeout: 10000 });

    // 2. サインアウトボタンをクリック
    await page.getByRole("button", { name: "サインアウト" }).click();

    // 3. /signin にリダイレクトされることを確認
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
  });
});
