import { expect, test } from "@playwright/test";

/** §9 chain1（ライフサイクル）用: 作成→詳細→更新→削除（テスト内作成・seed範囲 D001〜D007 外） */
const TEST_DL_CD = "DL901";
const TEST_DL_NAME = "E2Eテスト納品先";
const TEST_CUSTOMER_NAME = "株式会社山田製作所";

/** §9 chain2（ステータス管理）用: ライフサイクルとは別データコード */
const TEST_STATUS_DL_CD = "DL903";
const TEST_STATUS_DL_NAME = "E2Eステータス管理納品先";

/** 一般ユーザー作成・削除テスト用 */
const TEST_USER_DL_CD = "DL902";
const TEST_USER_DL_NAME = "E2E一般テスト納品先";

test.describe("納品先CRUD（管理者）", () => {
  // §9 chain1: 作成 → 詳細確認 → 更新 → 削除（1 ライフサイクル × 1 関心事・§4 ステップ数 4）
  test.describe.serial("ライフサイクル", () => {
    test("新規納品先を作成できる", async ({ page }) => {
      // 一覧画面から新規登録画面に遷移
      await page.goto("/delivery-locations");
      await page.getByRole("link", { name: "新規登録" }).click();
      await expect(page).toHaveURL("/delivery-locations/new", { timeout: 10000 });
      await expect(page.getByRole("heading", { name: "納品先登録" })).toBeVisible();

      // フォーム入力
      await page.getByLabel("取引先コード").fill(TEST_DL_CD);
      await page.getByLabel("名前").fill(TEST_DL_NAME);
      await page.getByLabel("得意先").selectOption({ label: TEST_CUSTOMER_NAME });
      await page.getByLabel("郵便番号").fill("1000001");
      await page.getByLabel("都道府県").selectOption("東京都");
      await page.getByLabel("住所").fill("千代田区テスト1-1-1");
      await page.getByLabel("電話番号").fill("0312345000");
      await page.getByLabel("FAX番号").fill("0312345001");
      await page.getByLabel("担当者").fill("テスト担当");
      await page.getByLabel("配送時注意事項").fill("E2Eテスト配送メモ");

      // 登録実行
      await page.getByRole("button", { name: "登録" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/delivery-locations/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("納品先を登録しました。")).toBeVisible({ timeout: 10000 });

      // 作成した納品先が検索で見つかる
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("コード").fill(TEST_DL_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`code=${TEST_DL_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_DL_CD })).toBeVisible();
    });

    test("納品先詳細を確認できる", async ({ page }) => {
      await page.goto(`/delivery-locations/${TEST_DL_CD}`);

      // 編集画面で表示されること
      await expect(page.getByRole("heading", { name: "納品先編集" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "納品先情報" })).toBeVisible();

      // 取引先コードが読み取り専用であること
      await expect(page.locator("#code-display")).toBeDisabled();
      await expect(page.locator("#code-display")).toHaveValue(TEST_DL_CD);

      // 親得意先リンクが正しいこと
      const customerLink = page.getByRole("link", { name: TEST_CUSTOMER_NAME });
      await expect(customerLink).toBeVisible();
      await expect(customerLink).toHaveAttribute("href", "/customers/C001");

      // 各フィールドの値が正しいこと
      await expect(page.getByLabel("名前")).toHaveValue(TEST_DL_NAME);
      await expect(page.getByLabel("郵便番号")).toHaveValue("1000001");
      await expect(page.getByLabel("都道府県")).toHaveValue("東京都");
      await expect(page.getByLabel("住所")).toHaveValue("千代田区テスト1-1-1");
      await expect(page.getByLabel("電話番号")).toHaveValue("0312345000");
      await expect(page.getByLabel("FAX番号")).toHaveValue("0312345001");
      await expect(page.getByLabel("担当者")).toHaveValue("テスト担当");
      await expect(page.getByLabel("配送時注意事項")).toHaveValue("E2Eテスト配送メモ");

      // ボタンが表示されること
      await expect(page.getByRole("button", { name: "更新" })).toBeVisible();
      await expect(page.getByRole("button", { name: "無効化" })).toBeVisible();
      await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
    });

    test("納品先情報を更新できる", async ({ page }) => {
      await page.goto(`/delivery-locations/${TEST_DL_CD}`);
      await expect(page.getByRole("heading", { name: "納品先編集" })).toBeVisible();

      // 取引先コードが読み取り専用であること
      await expect(page.locator("#code-display")).toBeDisabled();

      // フィールドを変更
      const nameField = page.getByLabel("名前");
      await nameField.clear();
      await nameField.fill("E2E更新テスト納品先");

      const contactField = page.getByLabel("担当者");
      await contactField.clear();
      await contactField.fill("更新担当");

      // 更新実行
      await page.getByRole("button", { name: "更新" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("納品先情報を更新しました。")).toBeVisible({
        timeout: 10000,
      });

      // 変更が反映されていること
      await expect(nameField).toHaveValue("E2E更新テスト納品先");
      await expect(contactField).toHaveValue("更新担当");
    });

    test("納品先を削除できる", async ({ page }) => {
      await page.goto(`/delivery-locations/${TEST_DL_CD}`);
      await expect(page.getByRole("heading", { name: "納品先編集" })).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/delivery-locations/, { timeout: 10000 });
      await expect(page.getByText("納品先を削除しました。")).toBeVisible({ timeout: 10000 });

      // 削除した納品先が検索で見つからない
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("コード").fill(TEST_DL_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`code=${TEST_DL_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_DL_CD })).not.toBeVisible();
    });
  });

  // §9 chain2: 作成 → 無効化 → 有効化 → 削除（ステータス管理は独立 chain・§4・別データコード DL903）
  test.describe.serial("ステータス管理", () => {
    test("ステータス管理用の納品先を作成できる", async ({ page }) => {
      // 最小フォーム入力で作成（フィールド網羅はライフサイクル chain の関心事）
      await page.goto("/delivery-locations/new");
      await expect(page.getByRole("heading", { name: "納品先登録" })).toBeVisible();

      await page.getByLabel("取引先コード").fill(TEST_STATUS_DL_CD);
      await page.getByLabel("名前").fill(TEST_STATUS_DL_NAME);
      await page.getByLabel("得意先").selectOption({ label: TEST_CUSTOMER_NAME });

      await page.getByRole("button", { name: "登録" }).click();

      await expect(page).toHaveURL(/\/delivery-locations/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("納品先を登録しました。")).toBeVisible({ timeout: 10000 });
    });

    test("納品先を無効化できる", async ({ page }) => {
      await page.goto(`/delivery-locations/${TEST_STATUS_DL_CD}`);
      await expect(page.getByRole("heading", { name: "納品先編集" })).toBeVisible();

      // 「無効化」ボタンが表示されること（有効状態）
      await expect(page.getByRole("button", { name: "無効化" })).toBeVisible();

      // 無効化実行
      await page.getByRole("button", { name: "無効化" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("納品先を無効化しました。")).toBeVisible({ timeout: 10000 });

      // 「有効化」ボタンに切り替わること（無効状態）
      await expect(page.getByRole("button", { name: "有効化" })).toBeVisible();
    });

    test("納品先を有効化できる", async ({ page }) => {
      await page.goto(`/delivery-locations/${TEST_STATUS_DL_CD}`);
      await expect(page.getByRole("heading", { name: "納品先編集" })).toBeVisible();

      // 「有効化」ボタンが表示されること（無効状態）
      await expect(page.getByRole("button", { name: "有効化" })).toBeVisible();

      // 有効化実行
      await page.getByRole("button", { name: "有効化" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("納品先を有効化しました。")).toBeVisible({ timeout: 10000 });

      // 「無効化」ボタンに切り替わること（有効状態）
      await expect(page.getByRole("button", { name: "無効化" })).toBeVisible();
    });

    test("納品先を削除できる", async ({ page }) => {
      await page.goto(`/delivery-locations/${TEST_STATUS_DL_CD}`);
      await expect(page.getByRole("heading", { name: "納品先編集" })).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/delivery-locations/, { timeout: 10000 });
      await expect(page.getByText("納品先を削除しました。")).toBeVisible({ timeout: 10000 });

      // 削除した納品先が検索で見つからない
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("コード").fill(TEST_STATUS_DL_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`code=${TEST_STATUS_DL_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_STATUS_DL_CD })).not.toBeVisible();
    });
  });

  test("重複する取引先コードでエラーが表示される", async ({ page }) => {
    await page.goto("/delivery-locations/new");

    await page.getByLabel("取引先コード").fill("D001"); // 既存の納品先コード（共通シード・簡易エラー §3）
    await page.getByLabel("名前").fill("重複テスト納品先");
    await page.getByLabel("得意先").selectOption({ label: TEST_CUSTOMER_NAME });

    await page.getByRole("button", { name: "登録" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/delivery-locations\/new/);
  });
});

test.describe("納品先CRUD（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test.describe.serial("一般ユーザーも作成・削除できる", () => {
    test("一般ユーザーが新規納品先を作成できる", async ({ page }) => {
      await page.goto("/delivery-locations");

      // 新規登録ボタンが表示されること
      await expect(page.getByRole("link", { name: "新規登録" })).toBeVisible();

      await page.goto("/delivery-locations/new");
      await expect(page.getByRole("heading", { name: "納品先登録" })).toBeVisible();

      await page.getByLabel("取引先コード").fill(TEST_USER_DL_CD);
      await page.getByLabel("名前").fill(TEST_USER_DL_NAME);
      await page.getByLabel("得意先").selectOption({ label: TEST_CUSTOMER_NAME });

      await page.getByRole("button", { name: "登録" }).click();

      await expect(page).toHaveURL(/\/delivery-locations/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("納品先を登録しました。")).toBeVisible({ timeout: 10000 });
    });

    test("一般ユーザーが納品先を削除できる", async ({ page }) => {
      await page.goto(`/delivery-locations/${TEST_USER_DL_CD}`);
      await expect(page.getByRole("heading", { name: "納品先編集" })).toBeVisible();

      // 削除ボタンが表示されること
      await expect(page.getByRole("button", { name: "削除" })).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      await expect(page).toHaveURL(/\/delivery-locations/, { timeout: 10000 });
      await expect(page.getByText("納品先を削除しました。")).toBeVisible({ timeout: 10000 });
    });
  });
});
