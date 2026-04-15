import { expect, test } from "@playwright/test";

/** テストで使用する固定の得意先データ（seed範囲 C001〜C005 外） */
const TEST_CUSTOMER_CD = "CUST901";
const TEST_CUSTOMER_NAME = "E2Eテスト得意先";

/** 一般ユーザー作成・削除テスト用 */
const TEST_USER_CUSTOMER_CD = "CUST902";
const TEST_USER_CUSTOMER_NAME = "E2E一般テスト得意先";

test.describe("得意先CRUD（管理者）", () => {
  // 作成→詳細確認→更新→無効化→有効化→削除の順で実行（同一テストデータを使い回すため serial で順序保証）
  test.describe.serial("作成・更新・ステータス変更・削除テスト", () => {
    test("新規得意先を作成できる", async ({ page }) => {
      // 一覧画面から新規登録画面に遷移
      await page.goto("/customers");
      await page.getByRole("link", { name: "新規登録" }).click();
      await expect(page).toHaveURL("/customers/new", { timeout: 10000 });
      await expect(page.getByRole("heading", { name: "得意先登録" })).toBeVisible();

      // フォーム入力
      await page.getByLabel("取引先コード").fill(TEST_CUSTOMER_CD);
      await page.getByLabel("名前").fill(TEST_CUSTOMER_NAME);
      await page.getByLabel("郵便番号").fill("1000001");
      await page.getByLabel("都道府県").selectOption("東京都");
      await page.getByLabel("住所").fill("千代田区テスト1-1-1");
      await page.getByLabel("電話番号").fill("0312345000");
      await page.getByLabel("FAX番号").fill("0312345001");
      await page.getByLabel("担当者").fill("テスト担当");
      await page.getByLabel("マージン率").fill("15.50");

      // 登録実行
      await page.getByRole("button", { name: "登録" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("得意先を登録しました。")).toBeVisible({ timeout: 10000 });

      // 作成した得意先が検索で見つかる
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("コード").fill(TEST_CUSTOMER_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`code=${TEST_CUSTOMER_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_CUSTOMER_CD })).toBeVisible();
    });

    test("得意先詳細を確認できる", async ({ page }) => {
      await page.goto(`/customers/${TEST_CUSTOMER_CD}`);

      // 編集画面で表示されること
      await expect(page.getByRole("heading", { name: "得意先編集" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "取引先情報" })).toBeVisible();

      // 取引先コードが読み取り専用であること
      await expect(page.locator("#code-display")).toBeDisabled();
      await expect(page.locator("#code-display")).toHaveValue(TEST_CUSTOMER_CD);

      // 各フィールドの値が正しいこと
      await expect(page.getByLabel("名前")).toHaveValue(TEST_CUSTOMER_NAME);
      await expect(page.getByLabel("郵便番号")).toHaveValue("1000001");
      await expect(page.getByLabel("都道府県")).toHaveValue("東京都");
      await expect(page.getByLabel("住所")).toHaveValue("千代田区テスト1-1-1");
      await expect(page.getByLabel("電話番号")).toHaveValue("0312345000");
      await expect(page.getByLabel("FAX番号")).toHaveValue("0312345001");
      await expect(page.getByLabel("担当者")).toHaveValue("テスト担当");
      await expect(page.getByLabel("マージン率")).toHaveValue("15.5");

      // 配下の納品先セクション
      await expect(page.getByRole("heading", { name: "配下の納品先" })).toBeVisible();
      await expect(page.getByText("納品先が登録されていません")).toBeVisible();

      // ボタンが表示されること
      await expect(page.getByRole("button", { name: "更新" })).toBeVisible();
      await expect(page.getByRole("button", { name: "無効化" })).toBeVisible();
      await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
    });

    test("得意先情報を更新できる", async ({ page }) => {
      await page.goto(`/customers/${TEST_CUSTOMER_CD}`);
      await expect(page.getByRole("heading", { name: "得意先編集" })).toBeVisible();

      // 取引先コードが読み取り専用であること
      await expect(page.locator("#code-display")).toBeDisabled();

      // フィールドを変更
      const nameField = page.getByLabel("名前");
      await nameField.clear();
      await nameField.fill("E2E更新テスト得意先");

      const contactField = page.getByLabel("担当者");
      await contactField.clear();
      await contactField.fill("更新担当");

      const marginField = page.getByLabel("マージン率");
      await marginField.clear();
      await marginField.fill("20.00");

      // 更新実行
      await page.getByRole("button", { name: "更新" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("得意先情報を更新しました。")).toBeVisible({
        timeout: 10000,
      });

      // 変更が反映されていること
      await expect(nameField).toHaveValue("E2E更新テスト得意先");
      await expect(contactField).toHaveValue("更新担当");
    });

    test("得意先を無効化できる", async ({ page }) => {
      await page.goto(`/customers/${TEST_CUSTOMER_CD}`);
      await expect(page.getByRole("heading", { name: "得意先編集" })).toBeVisible();

      // 「無効化」ボタンが表示されること（有効状態）
      await expect(page.getByRole("button", { name: "無効化" })).toBeVisible();

      // 無効化実行
      await page.getByRole("button", { name: "無効化" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("得意先を無効化しました。")).toBeVisible({ timeout: 10000 });

      // 「有効化」ボタンに切り替わること（無効状態）
      await expect(page.getByRole("button", { name: "有効化" })).toBeVisible();
    });

    test("得意先を有効化できる", async ({ page }) => {
      await page.goto(`/customers/${TEST_CUSTOMER_CD}`);
      await expect(page.getByRole("heading", { name: "得意先編集" })).toBeVisible();

      // 「有効化」ボタンが表示されること（無効状態）
      await expect(page.getByRole("button", { name: "有効化" })).toBeVisible();

      // 有効化実行
      await page.getByRole("button", { name: "有効化" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("得意先を有効化しました。")).toBeVisible({ timeout: 10000 });

      // 「無効化」ボタンに切り替わること（有効状態）
      await expect(page.getByRole("button", { name: "無効化" })).toBeVisible();
    });

    test("得意先を削除できる", async ({ page }) => {
      await page.goto(`/customers/${TEST_CUSTOMER_CD}`);
      await expect(page.getByRole("heading", { name: "得意先編集" })).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });
      await expect(page.getByText("得意先を削除しました。")).toBeVisible({ timeout: 10000 });

      // 削除した得意先が検索で見つからない
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("コード").fill(TEST_CUSTOMER_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`code=${TEST_CUSTOMER_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_CUSTOMER_CD })).not.toBeVisible();
    });
  });

  test("納品先がある得意先は削除できない", async ({ page }) => {
    // C001は納品先（D001, D002）を持つシードデータ
    await page.goto("/customers/C001");
    await expect(page.getByRole("heading", { name: "得意先編集" })).toBeVisible();

    // 削除実行
    await page.getByRole("button", { name: "削除" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    // 詳細画面に留まっていること
    await expect(page.getByRole("heading", { name: "得意先編集" })).toBeVisible();
  });

  test("重複する取引先コードでエラーが表示される", async ({ page }) => {
    await page.goto("/customers/new");

    await page.getByLabel("取引先コード").fill("C001"); // 既存の得意先コード
    await page.getByLabel("名前").fill("重複テスト得意先");

    await page.getByRole("button", { name: "登録" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/customers\/new/);
  });
});

test.describe("得意先CRUD（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test.describe.serial("一般ユーザーも作成・削除できる", () => {
    test("一般ユーザーが新規得意先を作成できる", async ({ page }) => {
      await page.goto("/customers");

      // 新規登録ボタンが表示されること
      await expect(page.getByRole("link", { name: "新規登録" })).toBeVisible();

      await page.goto("/customers/new");
      await expect(page.getByRole("heading", { name: "得意先登録" })).toBeVisible();

      await page.getByLabel("取引先コード").fill(TEST_USER_CUSTOMER_CD);
      await page.getByLabel("名前").fill(TEST_USER_CUSTOMER_NAME);

      await page.getByRole("button", { name: "登録" }).click();

      await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("得意先を登録しました。")).toBeVisible({ timeout: 10000 });
    });

    test("一般ユーザーが得意先を削除できる", async ({ page }) => {
      await page.goto(`/customers/${TEST_USER_CUSTOMER_CD}`);
      await expect(page.getByRole("heading", { name: "得意先編集" })).toBeVisible();

      // 削除ボタンが表示されること
      await expect(page.getByRole("button", { name: "削除" })).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });
      await expect(page.getByText("得意先を削除しました。")).toBeVisible({ timeout: 10000 });
    });
  });
});
