import { expect, test } from "@playwright/test";

/** テストで使用する固定の役割データ（seed範囲 ROLE001〜ROLE015 外） */
const TEST_ROLE_CD = "ROLE901";

test.describe("役割新規作成（管理者）", () => {
  // 暫定対応: テストで作成した役割をUIから削除する
  test.afterEach(async ({ page }) => {
    await page.goto(`/roles/${TEST_ROLE_CD}`);
    const deleteButton = page.getByRole("button", { name: "削除" });
    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click();
      await expect(page).toHaveURL(/\/roles/, { timeout: 10000 });
    }
  });

  test("管理者が新規役割を作成できる", async ({ page }) => {
    // 一覧画面から新規登録画面に遷移
    await page.goto("/roles");
    await page.getByRole("link", { name: "新規登録" }).click();
    await expect(page).toHaveURL("/roles/new", { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "新規役割登録" })).toBeVisible();

    // フォーム入力
    await page.getByLabel("役割コード").fill(TEST_ROLE_CD);
    await page.getByLabel("役割名").fill("E2Eテスト役割");
    await page.getByLabel("役職").selectOption({ label: "課長" });
    // 上位役割ドロップダウンが表示されるのを待って選択
    await expect(page.getByLabel("上位役割")).toBeVisible();
    await page.getByLabel("上位役割").selectOption({ index: 1 }); // 最初の上位役割を選択

    // 登録実行
    await page.getByRole("button", { name: "登録" }).click();

    // 一覧画面にリダイレクトされ、成功トーストが表示される
    await expect(page).toHaveURL(/\/roles/, { timeout: 10000 });
    await page.waitForLoadState("load");
    await expect(page.getByText("役割を登録しました。")).toBeVisible({ timeout: 10000 });

    // 作成した役割が検索で見つかる
    await expect(page.locator("table tbody tr").first()).toBeVisible();
    await page.getByLabel("役割コード").fill(TEST_ROLE_CD);
    await page.getByRole("button", { name: "検索" }).click();
    await expect(page).toHaveURL(new RegExp(`roleCd=${TEST_ROLE_CD}`), {
      timeout: 10000,
    });
    await expect(page.getByRole("link", { name: TEST_ROLE_CD })).toBeVisible();
  });

  test("重複する役割コードでエラーが表示される", async ({ page }) => {
    await page.goto("/roles/new");

    await page.getByLabel("役割コード").fill("ROLE001"); // 既存の役割コード
    await page.getByLabel("役割名").fill("重複テスト");
    await page.getByLabel("役職").selectOption({ label: "課長" });

    await page.getByRole("button", { name: "登録" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/roles\/new/);
  });

  test("役割名が未入力でバリデーションエラーが表示される", async ({ page }) => {
    await page.goto("/roles/new");

    await page.getByLabel("役割コード").fill(TEST_ROLE_CD);
    // 役割名は空のまま
    await page.getByLabel("役職").selectOption({ label: "課長" });

    await page.getByRole("button", { name: "登録" }).click();

    // バリデーションエラーが表示される
    await expect(page.getByText(/役割名/)).toBeVisible();
  });

  test("キャンセルボタンで一覧に戻れる", async ({ page }) => {
    await page.goto("/roles/new");

    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL(/\/roles$/, { timeout: 10000 });
  });
});

test.describe("動的上位役割フィルタリング（管理者）", () => {
  test("役職選択で上位役割候補がフィルタリングされる", async ({ page }) => {
    await page.goto("/roles/new");

    // 課長を選択すると、上位役割に部長系の役割が表示される
    await page.getByLabel("役職").selectOption({ label: "課長" });

    await expect(page.getByLabel("上位役割")).toBeVisible();
    // 部長系の役割がオプションに含まれること
    const options = page.getByLabel("上位役割").locator("option");
    await expect(options.filter({ hasText: "営業部長" })).toBeAttached();
    await expect(options.filter({ hasText: "開発部長" })).toBeAttached();
  });

  test("役職変更で上位役割の選択がリセットされる", async ({ page }) => {
    await page.goto("/roles/new");

    // 課長を選択して上位役割を選ぶ
    await page.getByLabel("役職").selectOption({ label: "課長" });
    await expect(page.getByLabel("上位役割")).toBeVisible();
    await page.getByLabel("上位役割").selectOption({ index: 1 });

    // 部長に変更すると上位役割の選択肢が本部長系に変わる
    await page.getByLabel("役職").selectOption({ label: "部長" });
    await expect(page.getByLabel("上位役割")).toBeVisible();
    // 本部長系がオプションに含まれること
    const options = page.getByLabel("上位役割").locator("option");
    await expect(options.filter({ hasText: "営業本部長" })).toBeAttached();
    await expect(options.filter({ hasText: "管理本部長" })).toBeAttached();
  });

  test("最上位役職では上位役割が表示されない", async ({ page }) => {
    await page.goto("/roles/new");

    // 社長を選択すると上位役割ドロップダウンは非表示
    await page.getByLabel("役職").selectOption({ label: "社長" });

    await expect(page.getByLabel("上位役割")).not.toBeVisible();
    await expect(
      page.getByText("この役職には上位役職がないため、上位役割は設定できません。")
    ).toBeVisible();
  });

  test("本部長選択で社長の役割が上位候補になる", async ({ page }) => {
    await page.goto("/roles/new");

    // 本部長を選択すると上位役割に社長が表示される
    await page.getByLabel("役職").selectOption({ label: "本部長" });

    await expect(page.getByLabel("上位役割")).toBeVisible();
    const options = page.getByLabel("上位役割").locator("option");
    await expect(options.filter({ hasText: "社長" })).toBeAttached();
  });
});

test.describe("役割新規作成（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーは新規作成画面にアクセスできない", async ({ page }) => {
    await page.goto("/roles/new");

    // 権限がないため /signin にリダイレクトされる
    await expect(page).toHaveURL(/\/signin\?reason=forbidden/, { timeout: 10000 });
  });
});
