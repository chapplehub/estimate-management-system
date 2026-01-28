import { test, expect } from "@playwright/test";

test.describe("ログイン画面", () => {
  test("正しい認証情報でログインに成功する", async ({ page }) => {
    // ログインページにアクセス
    await page.goto("/signin");

    // メールアドレスを入力
    await page.getByLabel("メールアドレス").fill("employee1@example.com");

    // パスワードを入力
    await page.getByLabel("パスワード").fill("pass123!");

    // サインインボタンをクリック
    await page.getByRole("button", { name: "サインイン" }).click();

    // /employees にリダイレクトされることを確認
    await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
  });
});
