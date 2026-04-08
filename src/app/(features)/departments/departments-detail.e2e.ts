import { expect, test } from "@playwright/test";

/** テストで使用する固定の部署データ（seed範囲 DEPT001〜DEPT005 外） */
const TEST_UPDATE_DEPT_CD = "DEPT904";
const TEST_DELETE_DEPT_CD = "DEPT902";
const PARENT_DEPT_CD = "DEPT901";
const CHILD_DEPT_CD = "DEPT903";
const TEST_ISACTIVE_DEPT_CD = "DEPT905";

/**
 * テスト用部署を新規作成画面から作成し、一覧にリダイレクトされるまで待つ。
 */
async function createTestDepartment(
  page: import("@playwright/test").Page,
  data: { departmentCd: string; name: string; abbreviation: string; parentName?: string }
) {
  await page.goto("/departments/new");
  await expect(page.getByRole("heading", { name: "新規部署登録" })).toBeVisible();
  await page.getByLabel("部署コード").fill(data.departmentCd);
  await page.getByLabel("部署名").fill(data.name);
  await page.getByLabel("略称").fill(data.abbreviation);
  if (data.parentName) {
    await page.getByLabel("親部署").selectOption({ label: data.parentName });
  }
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
}

/**
 * テスト用部署をUIから削除する。存在しない場合はスキップ。
 */
async function deleteTestDepartment(page: import("@playwright/test").Page, departmentCd: string) {
  await page.goto(`/departments/${departmentCd}`);
  const deleteButton = page.getByRole("button", { name: "削除" });
  if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await deleteButton.click();
    await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
  }
}

test.describe("部署詳細・編集・削除（管理者）", () => {
  test.describe("更新テスト", () => {
    test.beforeEach(async ({ page }) => {
      await createTestDepartment(page, {
        departmentCd: TEST_UPDATE_DEPT_CD,
        name: "更新テスト部署",
        abbreviation: "更新テスト",
      });
    });

    test.afterEach(async ({ page }) => {
      await deleteTestDepartment(page, TEST_UPDATE_DEPT_CD);
    });

    test("管理者が部署情報を更新できる", async ({ page }) => {
      await page.goto(`/departments/${TEST_UPDATE_DEPT_CD}`);

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
  });

  test("管理者には削除ボタンが表示される", async ({ page }) => {
    await page.goto("/departments/DEPT003");

    await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
  });

  test.describe("削除テスト", () => {
    test.beforeEach(async ({ page }) => {
      await createTestDepartment(page, {
        departmentCd: TEST_DELETE_DEPT_CD,
        name: "削除テスト部署",
        abbreviation: "削除テスト",
      });
    });

    test("管理者が部署を削除できる", async ({ page }) => {
      // 作成した部署の詳細画面に遷移
      await page.goto(`/departments/${TEST_DELETE_DEPT_CD}`);
      await expect(page.getByText("部署変更")).toBeVisible();

      // 削除実行
      await page.getByRole("button", { name: "削除" }).click();

      // 一覧画面にリダイレクトされ、成功トーストが表示される
      await expect(page).toHaveURL(/\/departments/, { timeout: 10000 });
      await expect(page.getByText("部署を削除しました。")).toBeVisible({ timeout: 10000 });

      // 削除した部署が検索で見つからない
      await expect(page.locator("table tbody tr").first()).toBeVisible();
      await page.getByLabel("部署コード").fill(TEST_DELETE_DEPT_CD);
      await page.getByRole("button", { name: "検索" }).click();
      await expect(page).toHaveURL(new RegExp(`departmentCd=${TEST_DELETE_DEPT_CD}`), {
        timeout: 10000,
      });
      await expect(page.getByRole("link", { name: TEST_DELETE_DEPT_CD })).not.toBeVisible();
    });
  });

  test.describe("子部署削除制約テスト", () => {
    test.beforeEach(async ({ page }) => {
      // 親部署を作成してから子部署を作成
      await createTestDepartment(page, {
        departmentCd: PARENT_DEPT_CD,
        name: "親部署テスト",
        abbreviation: "親テスト",
      });
      await createTestDepartment(page, {
        departmentCd: CHILD_DEPT_CD,
        name: "子部署テスト",
        abbreviation: "子テスト",
        parentName: "親部署テスト",
      });
    });

    test.afterEach(async ({ page }) => {
      // 子部署を先に削除してから親部署を削除
      await deleteTestDepartment(page, CHILD_DEPT_CD);
      await deleteTestDepartment(page, PARENT_DEPT_CD);
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
  });

  test("存在しない部署コードで404が表示される", async ({ page }) => {
    await page.goto("/departments/DEPT999");

    // 404ページが表示されること
    await expect(page.getByText("404")).toBeVisible({ timeout: 10000 });
  });

  test.describe("isActive変更テスト", () => {
    test.beforeEach(async ({ page }) => {
      await createTestDepartment(page, {
        departmentCd: TEST_ISACTIVE_DEPT_CD,
        name: "isActiveテスト部署",
        abbreviation: "isActive",
      });
    });

    test.afterEach(async ({ page }) => {
      await deleteTestDepartment(page, TEST_ISACTIVE_DEPT_CD);
    });

    test("管理者がisActiveを変更できる", async ({ page }) => {
      await page.goto(`/departments/${TEST_ISACTIVE_DEPT_CD}`);
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
  });
});

test.describe("部署詳細（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

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
