import { expect, test } from "@playwright/test";

/** テストで使用する固定の部署データ（seed範囲 DEPT001〜DEPT003 外） */
const TEST_DEPT_CD = "DEPT901";
const TEST_DEPT_NAME = "E2Eテスト部署";
const TEST_DEPT_ABBR = "E2Eテスト";

/** 子部署削除制約テスト用 */
const PARENT_DEPT_CD = "DEPT902";
const CHILD_DEPT_CD = "DEPT903";

test.describe("部署CRUD（管理者）", () => {
  // 作成→更新→isActive変更→削除の順で実行（同一テストデータを使い回すため serial で順序保証）
  test.describe.serial("作成・更新・削除テスト", () => {
    test("管理者が新規部署を作成できる", async ({ page }) => {
      // 一覧画面から新規登録画面に遷移
      await page.goto("/departments");
      await page.getByRole("link", { name: "新規登録" }).click();
      await expect(page).toHaveURL("/departments/new", { timeout: 10000 });
      await expect(page.getByRole("heading", { name: "新規部署登録" })).toBeVisible();

      // フォーム入力
      await page.getByLabel("部署コード").fill(TEST_DEPT_CD);
      await page.getByLabel("部署名").fill(TEST_DEPT_NAME);
      await page.getByLabel("略称").fill(TEST_DEPT_ABBR);

      // 登録実行
      await page.getByRole("button", { name: "登録" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("部署を登録しました。")).toBeVisible({ timeout: 10000 });

      // 作成した部署が検索で見つかる
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("部署コード").fill(TEST_DEPT_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`departmentCd=${TEST_DEPT_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_DEPT_CD })).toBeVisible();
    });

    test("管理者が部署情報を更新できる", async ({ page }) => {
      await page.goto(`/departments/${TEST_DEPT_CD}`);

      // 編集モードで表示されること
      await expect(page.getByRole("heading", { name: "部署管理" })).toBeVisible();
      await expect(page.getByText("部署変更")).toBeVisible();

      // 部署コードが読み取り専用であること
      await expect(page.locator("#departmentCd-display")).toBeDisabled();

      // 部署名を変更して更新
      const nameField = page.getByLabel("部署名");
      await nameField.clear();
      await nameField.fill("E2E更新テスト");
      await page.getByRole("button", { name: "更新" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("部署情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // 変更が反映されていること
      await expect(nameField).toHaveValue("E2E更新テスト");
    });

    test("管理者がisActiveを変更できる", async ({ page }) => {
      await page.goto(`/departments/${TEST_DEPT_CD}`);
      await expect(page.getByText("部署変更")).toBeVisible();

      // デフォルトで「有効」チェックボックスがONであること
      const isActiveCheckbox = page.getByLabel("有効");
      await expect(isActiveCheckbox).toBeChecked();

      // チェックをOFFにして更新
      await isActiveCheckbox.uncheck();
      await page.getByRole("button", { name: "更新" }).click();

      // 成功トーストが表示される
      await expect(page.getByText("部署情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // チェックボックスがOFFになっていること
      await expect(isActiveCheckbox).not.toBeChecked();
    });

    test("管理者が部署を削除できる", async ({ page }) => {
      await page.goto(`/departments/${TEST_DEPT_CD}`);
      await expect(page.getByText("部署変更")).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
      await expect(page.getByText("部署を削除しました。")).toBeVisible({ timeout: 10000 });

      // 削除した部署が検索で見つからない
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("部署コード").fill(TEST_DEPT_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`departmentCd=${TEST_DEPT_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_DEPT_CD })).not.toBeVisible();
    });
  });

  // 親部署→子部署の作成・制約テスト・削除を直列実行
  test.describe.serial("子部署削除制約テスト", () => {
    test("親部署を作成できる", async ({ page }) => {
      await page.goto("/departments/new");
      await expect(page.getByRole("heading", { name: "新規部署登録" })).toBeVisible();

      await page.getByLabel("部署コード").fill(PARENT_DEPT_CD);
      await page.getByLabel("部署名").fill("親部署テスト");
      await page.getByLabel("略称").fill("親テスト");
      await page.getByRole("button", { name: "登録" }).click();

      await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
      await expect(page.getByText("部署を登録しました。")).toBeVisible({ timeout: 10000 });
    });

    test("子部署を作成できる", async ({ page }) => {
      await page.goto("/departments/new");
      await expect(page.getByRole("heading", { name: "新規部署登録" })).toBeVisible();

      await page.getByLabel("部署コード").fill(CHILD_DEPT_CD);
      await page.getByLabel("部署名").fill("子部署テスト");
      await page.getByLabel("略称").fill("子テスト");
      await page.getByLabel("親部署").selectOption({ label: "親部署テスト" });
      await page.getByRole("button", { name: "登録" }).click();

      await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
      await expect(page.getByText("部署を登録しました。")).toBeVisible({ timeout: 10000 });
    });

    test("子部署がある場合は削除できない", async ({ page }) => {
      // 親部署の詳細画面に遷移
      await page.goto(`/departments/${PARENT_DEPT_CD}`);
      await expect(page.getByText("部署変更")).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // エラーメッセージが表示される（ページは遷移しない）
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
      // 詳細画面に留まっていること
      await expect(page.getByText("部署変更")).toBeVisible();
    });

    test("子部署を削除できる", async ({ page }) => {
      await page.goto(`/departments/${CHILD_DEPT_CD}`);
      await expect(page.getByText("部署変更")).toBeVisible();

      await page.getByRole("button", { name: "削除" }).click();

      await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
      await expect(page.getByText("部署を削除しました。")).toBeVisible({ timeout: 10000 });
    });

    test("親部署を削除できる", async ({ page }) => {
      await page.goto(`/departments/${PARENT_DEPT_CD}`);
      await expect(page.getByText("部署変更")).toBeVisible();

      await page.getByRole("button", { name: "削除" }).click();

      await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
      await expect(page.getByText("部署を削除しました。")).toBeVisible({ timeout: 10000 });
    });
  });

  test("重複する部署コードでエラーが表示される", async ({ page }) => {
    await page.goto("/departments/new");

    await page.getByLabel("部署コード").fill("DEPT001"); // 既存の部署コード
    await page.getByLabel("部署名").fill("重複テスト");
    await page.getByLabel("略称").fill("重複");

    await page.getByRole("button", { name: "登録" }).click();

    // エラーメッセージが表示される（ページは遷移しない）
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/departments\/new/);
  });

  test("キャンセルボタンで一覧に戻れる", async ({ page }) => {
    await page.goto("/departments/new");

    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL(/\/departments$/, { timeout: 10000 });
  });

  test("管理者には削除ボタンが表示される", async ({ page }) => {
    await page.goto("/departments/DEPT003");

    await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
  });

  test("存在しない部署コードで404が表示される", async ({ page }) => {
    await page.goto("/departments/DEPT999");

    // 404ページが表示されること
    await expect(page.getByText("404")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("部署（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーは新規作成画面にアクセスできない", async ({ page }) => {
    await page.goto("/departments/new");

    // 権限がないため /signin にリダイレクトされる
    await expect(page).toHaveURL(/\/signin\?reason=forbidden/, { timeout: 10000 });
  });

  test("一般ユーザーは閲覧のみ", async ({ page }) => {
    await page.goto("/departments/DEPT001");

    // 閲覧モードで表示されること
    await expect(page.getByText("部署詳細")).toBeVisible();
    // フィールドが無効（disabled）
    await expect(page.getByLabel("部署名")).toBeDisabled();
    await expect(page.getByLabel("略称")).toBeDisabled();
    // 更新ボタンが表示されない
    await expect(page.getByRole("button", { name: "更新" })).not.toBeVisible();
    // 削除ボタンが表示されない
    await expect(page.getByRole("button", { name: "削除" })).not.toBeVisible();
  });
});
