import { expect, test as setup } from "@playwright/test";

const ADMIN_AUTH_FILE = "playwright/.auth/admin.json";
const USER_AUTH_FILE = "playwright/.auth/user.json";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("メールアドレス").fill("employee1@example.com");
  await page.getByLabel("パスワード").fill("pass123!");
  await page.getByRole("button", { name: "サインイン" }).click();

  await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });

  await page.context().storageState({ path: ADMIN_AUTH_FILE });
});

setup("authenticate as user", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("メールアドレス").fill("employee2@example.com");
  await page.getByLabel("パスワード").fill("pass123!");
  await page.getByRole("button", { name: "サインイン" }).click();

  await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });

  await page.context().storageState({ path: USER_AUTH_FILE });
});
