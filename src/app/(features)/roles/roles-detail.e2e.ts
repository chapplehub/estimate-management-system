import { expect, test } from "@playwright/test";

/** テストで使用する固定の役割データ（seed範囲 ROLE001〜ROLE015 外） */
const TEST_ROLE_CD = "ROLE902";

/**
 * テスト用役割を新規作成画面から作成し、一覧にリダイレクトされるまで待つ。
 */
async function createTestRole(
  page: import("@playwright/test").Page,
  data: { roleCd: string; name: string }
) {
  await page.goto("/roles/new");
  await expect(page.getByRole("heading", { name: "新規役割登録" })).toBeVisible();
  await page.getByLabel("役割コード").fill(data.roleCd);
  await page.getByLabel("役割名").fill(data.name);
  await page.getByLabel("役職").selectOption({ label: "課長" });
  await expect(page.getByLabel("上位役割")).toBeVisible();
  await page.getByLabel("上位役割").selectOption({ index: 1 });
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page).toHaveURL(/\/roles/, { timeout: 10000 });
}

test.describe("役割詳細・編集・削除（管理者）", () => {
  // 更新→削除の順で実行（同一テストデータを使い回すため serial で順序保証）
  test.describe.serial("更新・削除テスト", () => {
    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      await createTestRole(page, {
        roleCd: TEST_ROLE_CD,
        name: "E2E詳細テスト役割",
      });
      await page.close();
    });

    test("管理者が役割情報を更新できる", async ({ page }) => {
      await page.goto(`/roles/${TEST_ROLE_CD}`);

      // 編集モードで表示されること
      await expect(page.getByRole("heading", { name: "役割管理" })).toBeVisible();
      await expect(page.getByText("役割変更")).toBeVisible();

      // 役割コードと役職が読み取り専用であること
      await expect(page.locator("#roleCd-display")).toBeDisabled();
      await expect(page.locator("#positionName-display")).toBeDisabled();

      // 名前を変更して更新
      const nameField = page.getByLabel("役割名");
      await nameField.clear();
      await nameField.fill("E2E更新テスト役割");
      await page.getByRole("button", { name: "更新" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("役割情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // 変更が反映されていること
      await expect(nameField).toHaveValue("E2E更新テスト役割");
    });

    test("管理者が未使用の役割を削除できる", async ({ page }) => {
      // 更新テストで作成済みの役割の詳細画面に遷移
      await page.goto(`/roles/${TEST_ROLE_CD}`);
      await expect(page.getByText("役割変更")).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/roles/, { timeout: 10000 });
      await expect(page.getByText("役割を削除しました。")).toBeVisible({ timeout: 10000 });

      // 削除した役割が検索で見つからない
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("役割コード").fill(TEST_ROLE_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`roleCd=${TEST_ROLE_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_ROLE_CD })).not.toBeVisible();
    });
  });

  test("使用中の役割は削除できない", async ({ page }) => {
    // ROLE009（営業一課長）は従業員に割り当てられている
    await page.goto("/roles/ROLE009");
    await expect(page.getByText("役割変更")).toBeVisible();

    await page.getByRole("button", { name: "削除" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/roles\/ROLE009/);
  });

  test("下位役割がある役割は削除できない", async ({ page }) => {
    // ROLE001（社長）は下位役割（ROLE002, ROLE003）を持つ
    await page.goto("/roles/ROLE001");
    await expect(page.getByText("役割変更")).toBeVisible();

    await page.getByRole("button", { name: "削除" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/roles\/ROLE001/);
  });

  test("存在しない役割コードで404が表示される", async ({ page }) => {
    await page.goto("/roles/ROLE999");

    // 404ページが表示されること
    await expect(page.getByText("404")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("役割詳細（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーは閲覧のみ", async ({ page }) => {
    await page.goto("/roles/ROLE001");

    // 閲覧モードで表示されること
    await expect(page.getByText("役割詳細")).toBeVisible();
    // フィールドが無効（disabled）
    await expect(page.getByLabel("役割名")).toBeDisabled();
    // 更新ボタンが表示されない
    await expect(page.getByRole("button", { name: "更新" })).not.toBeVisible();
    // 削除ボタンが表示されない
    await expect(page.getByRole("button", { name: "削除" })).not.toBeVisible();
  });
});
