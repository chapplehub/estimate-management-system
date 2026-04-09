import { expect, test } from "@playwright/test";

/** テストで使用する固定の従業員データ（seed範囲 EMP000001〜EMP002000 外） */
const TEST_EMPLOYEE_CD = "EMP099901";
const TEST_EMAIL = "e2e-create-test@example.com";

test.describe("従業員CRUD（管理者）", () => {
  // 作成→更新→削除の順で実行（同一テストデータを使い回すため serial で順序保証）
  test.describe.serial("作成・更新・削除テスト", () => {
    test("管理者が新規従業員を作成できる", async ({ page }) => {
      // 一覧画面から新規登録画面に遷移
      await page.goto("/employees");
      await page.getByRole("link", { name: "新規登録" }).click();
      await expect(page).toHaveURL("/employees/new", { timeout: 10000 });
      await expect(page.getByRole("heading", { name: "新規従業員登録" })).toBeVisible();

      // フォーム入力
      await page.getByLabel("名前").fill("E2Eテスト従業員");
      await page.getByLabel("メールアドレス").fill(TEST_EMAIL);
      await page.getByLabel("従業員コード").fill(TEST_EMPLOYEE_CD);
      await page.getByLabel("所属部署").selectOption({ index: 1 }); // 最初の部署を選択
      await page.getByLabel("パスワード").fill("testpass123");
      // 権限はデフォルト「一般ユーザー」のまま

      // 登録実行
      await page.getByRole("button", { name: "登録" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("従業員を登録しました。")).toBeVisible({ timeout: 10000 });

      // 作成した従業員が検索で見つかる
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("従業員コード").fill(TEST_EMPLOYEE_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`employeeCd=${TEST_EMPLOYEE_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_EMPLOYEE_CD })).toBeVisible();
    });

    test("管理者が従業員情報を更新できる", async ({ page }) => {
      await page.goto(`/employees/${TEST_EMPLOYEE_CD}`);

      // 編集モードで表示されること
      await expect(page.getByRole("heading", { name: "従業員管理" })).toBeVisible();
      await expect(page.getByText("従業員変更")).toBeVisible();

      // 従業員コードが読み取り専用であること
      await expect(page.locator("#employeeCd-display")).toBeDisabled();

      // 複数フィールドを変更して更新
      const nameField = page.getByLabel("名前");
      await nameField.clear();
      await nameField.fill("E2E更新テスト");

      const emailField = page.getByLabel("メールアドレス");
      await emailField.clear();
      await emailField.fill("e2e-updated@example.com");

      await page.getByLabel("所属部署").selectOption({ index: 2 }); // 別の部署に変更

      await page.getByRole("button", { name: "更新" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("従業員情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // 変更が反映されていること
      await expect(nameField).toHaveValue("E2E更新テスト");
      await expect(emailField).toHaveValue("e2e-updated@example.com");
    });

    test("管理者が従業員を削除できる", async ({ page }) => {
      // 作成・更新済みの従業員の詳細画面に遷移
      await page.goto(`/employees/${TEST_EMPLOYEE_CD}`);
      await expect(page.getByText("従業員変更")).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/employees/, { timeout: 10000 });
      await expect(page.getByText("従業員を削除しました。")).toBeVisible({ timeout: 10000 });

      // 削除した従業員が検索で見つからない
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("従業員コード").fill(TEST_EMPLOYEE_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`employeeCd=${TEST_EMPLOYEE_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_EMPLOYEE_CD })).not.toBeVisible();
    });
  });

  test("重複する従業員コードでエラーが表示される", async ({ page }) => {
    await page.goto("/employees/new");

    await page.getByLabel("名前").fill("重複テスト");
    await page.getByLabel("メールアドレス").fill("e2e-duplicate-test@example.com");
    await page.getByLabel("従業員コード").fill("EMP000001"); // 既存の従業員コード
    await page.getByLabel("所属部署").selectOption({ index: 1 });
    await page.getByLabel("パスワード").fill("testpass123");

    await page.getByRole("button", { name: "登録" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/employees\/new/);
  });

  test("キャンセルボタンで一覧に戻れる", async ({ page }) => {
    await page.goto("/employees/new");

    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL(/\/employees$/, { timeout: 10000 });
  });

  test("管理者には削除ボタンが表示される", async ({ page }) => {
    await page.goto("/employees/EMP000003");

    await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
  });

  test("存在しない従業員コードで404が表示される", async ({ page }) => {
    await page.goto("/employees/EMP999999");

    // 404ページが表示されること
    await expect(page.getByText("404")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("従業員（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーは新規作成画面にアクセスできない", async ({ page }) => {
    await page.goto("/employees/new");

    // 権限がないため /signin にリダイレクトされる
    await expect(page).toHaveURL(/\/signin\?reason=forbidden/, { timeout: 10000 });
  });

  test("本人は自分の情報を編集できる（owner権限）", async ({ page }) => {
    // employee2 (EMP000002) は user 認証のアカウント
    await page.goto("/employees/EMP000002");

    await expect(page.getByText("従業員変更")).toBeVisible();
    // フィールドが有効（disabled でない）
    await expect(page.getByLabel("名前")).toBeEnabled();
    await expect(page.getByLabel("メールアドレス")).toBeEnabled();
    // 更新ボタンが表示される
    await expect(page.getByRole("button", { name: "更新" })).toBeVisible();
  });

  test("一般ユーザーは他人の情報を閲覧のみ", async ({ page }) => {
    await page.goto("/employees/EMP000003");

    // 閲覧モードで表示されること
    await expect(page.getByText("従業員詳細")).toBeVisible();
    // フィールドが無効（disabled）
    await expect(page.getByLabel("名前")).toBeDisabled();
    await expect(page.getByLabel("メールアドレス")).toBeDisabled();
    // 更新ボタンが表示されない
    await expect(page.getByRole("button", { name: "更新" })).not.toBeVisible();
    // 削除ボタンが表示されない
    await expect(page.getByRole("button", { name: "削除" })).not.toBeVisible();
  });
});
