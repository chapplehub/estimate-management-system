import { expect, test } from "@playwright/test";

const TEST_INDIVIDUAL_CODE = "PRD901";
const TEST_SET_CODE = "PRD902";

test.describe("商品CRUD（管理者）", () => {
  test.describe.serial("作成・更新・削除テスト - 個別商品", () => {
    test("管理者が個別商品を作成できる", async ({ page }) => {
      await page.goto("/products");
      await expect(page.locator("table tbody tr").first()).toBeVisible();

      await page.getByRole("link", { name: "新規登録" }).click();
      await expect(page).toHaveURL("/products/new", { timeout: 10000 });
      await expect(page.getByRole("heading", { name: "新規商品登録" })).toBeVisible();

      await page.getByLabel("商品コード").fill(TEST_INDIVIDUAL_CODE);
      await page.getByLabel("商品名").fill("E2Eテスト個別商品");
      await page.getByLabel("商品区分").selectOption("INDIVIDUAL");
      await page.getByLabel("単位").selectOption("UNIT");
      await page.getByLabel("原価").fill("10000");
      await page.getByLabel("商品説明").fill("E2Eテスト用の個別商品です");

      await page.getByRole("button", { name: "登録" }).click();

      await expect(page).toHaveURL(/\/products/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("商品を登録しました。")).toBeVisible({ timeout: 10000 });
    });

    test("管理者が商品詳細を確認できる", async ({ page }) => {
      await page.goto(`/products/${TEST_INDIVIDUAL_CODE}`);
      await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();

      await expect(page.getByText(TEST_INDIVIDUAL_CODE)).toBeVisible();
      await expect(page.getByText("E2Eテスト個別商品")).toBeVisible();
      await expect(page.getByText("個別商品")).toBeVisible();
      await expect(page.getByText("台")).toBeVisible();
      await expect(page.getByText("有効")).toBeVisible();
      await expect(page.getByText("10,000円")).toBeVisible();
      await expect(page.getByText("E2Eテスト用の個別商品です")).toBeVisible();

      // 個別商品なので周辺商品セクションが表示される
      await expect(page.getByRole("heading", { name: "周辺商品" })).toBeVisible();

      // 管理者なので編集・無効化・削除ボタンが見える
      await expect(page.getByRole("link", { name: "編集" })).toBeVisible();
      await expect(page.getByRole("button", { name: "無効化" })).toBeVisible();
      await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
    });

    test("管理者が商品を編集できる", async ({ page }) => {
      await page.goto(`/products/${TEST_INDIVIDUAL_CODE}/edit`);
      await expect(page.getByRole("heading", { name: "商品編集" })).toBeVisible();

      // 商品区分は変更不可
      await expect(page.getByLabel("商品区分")).toBeDisabled();

      // 商品名を変更
      const nameField = page.getByLabel("商品名");
      await nameField.clear();
      await nameField.fill("E2E更新テスト個別商品");

      await page.getByRole("button", { name: "更新" }).click();

      await expect(page).toHaveURL(new RegExp(`/products/${TEST_INDIVIDUAL_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品情報を更新しました。")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("E2E更新テスト個別商品")).toBeVisible();
    });

    test("管理者が周辺商品を設定できる", async ({ page }) => {
      await page.goto(`/products/${TEST_INDIVIDUAL_CODE}/relations`);
      await expect(page.getByRole("heading", { name: "周辺商品設定" })).toBeVisible();

      // PRD002を周辺商品として追加
      await page.getByPlaceholder("例: PRD001").fill("PRD002");
      await page.getByRole("button", { name: "追加" }).click();

      // テーブルにPRD002が追加されたことを確認
      await expect(page.getByText("PRD002")).toBeVisible();

      await page.getByRole("button", { name: "保存" }).click();

      await expect(page).toHaveURL(new RegExp(`/products/${TEST_INDIVIDUAL_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // 詳細画面で周辺商品としてPRD002が表示される
      await expect(page.getByRole("heading", { name: "周辺商品" })).toBeVisible();
      const relationsTable = page.locator("table").filter({ hasText: "PRD002" });
      await expect(relationsTable).toBeVisible();
    });

    test("参照されている商品に無効化ダイアログが表示される", async ({ page }) => {
      // PRD002はPRD901から参照されているので、ダイアログが表示されるはず
      await page.goto("/products/PRD002");
      await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();

      // 無効化ボタンをクリック → ダイアログが開く
      await page.getByRole("button", { name: "無効化" }).click();

      // ダイアログが表示される
      await expect(page.getByText("商品の無効化")).toBeVisible();
      await expect(page.getByText("この商品は他の商品から参照されています")).toBeVisible();

      // 参照元としてPRD901が表示される
      await expect(page.getByText(TEST_INDIVIDUAL_CODE)).toBeVisible();

      // ダイアログを閉じる（×ボタン）
      await page.getByRole("button", { name: "Close" }).click();
    });

    test("管理者が商品を無効化できる", async ({ page }) => {
      await page.goto(`/products/${TEST_INDIVIDUAL_CODE}`);
      await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();

      await page.getByRole("button", { name: "無効化" }).click();

      await expect(page).toHaveURL(new RegExp(`/products/${TEST_INDIVIDUAL_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品を無効化しました。")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("無効")).toBeVisible();
    });

    test("管理者が商品を有効化できる", async ({ page }) => {
      await page.goto(`/products/${TEST_INDIVIDUAL_CODE}`);
      await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();

      await page.getByRole("button", { name: "有効化" }).click();

      await expect(page).toHaveURL(new RegExp(`/products/${TEST_INDIVIDUAL_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品を有効化しました。")).toBeVisible({ timeout: 10000 });
    });

    test("管理者が商品を削除できる", async ({ page }) => {
      await page.goto(`/products/${TEST_INDIVIDUAL_CODE}`);
      await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();

      await page.getByRole("button", { name: "削除" }).click();

      await expect(page).toHaveURL(/\/products/, { timeout: 10000 });
      await expect(page.getByText("商品を削除しました。")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe.serial("作成・削除テスト - セット商品", () => {
    test("管理者がセット商品を作成できる", async ({ page }) => {
      await page.goto("/products/new");
      await expect(page.getByRole("heading", { name: "新規商品登録" })).toBeVisible();

      await page.getByLabel("商品コード").fill(TEST_SET_CODE);
      await page.getByLabel("商品名").fill("E2Eテストセット商品");
      await page.getByLabel("商品区分").selectOption("SET");
      await page.getByLabel("単位").selectOption("SET");
      await page.getByLabel("商品説明").fill("E2Eテスト用のセット商品です");

      await page.getByRole("button", { name: "登録" }).click();

      await expect(page).toHaveURL(/\/products/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("商品を登録しました。")).toBeVisible({ timeout: 10000 });
    });

    test("管理者がセット構成を設定できる", async ({ page }) => {
      await page.goto(`/products/${TEST_SET_CODE}/components`);
      await expect(page.getByRole("heading", { name: "セット構成設定" })).toBeVisible();

      // PRD001を構成商品として追加
      await page.getByPlaceholder("例: PRD001").fill("PRD001");
      await page.getByRole("button", { name: "追加" }).click();

      await expect(page.getByText("PRD001")).toBeVisible();

      await page.getByRole("button", { name: "保存" }).click();

      await expect(page).toHaveURL(new RegExp(`/products/${TEST_SET_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // 詳細画面でセット構成としてPRD001が表示される
      await expect(page.getByRole("heading", { name: "セット構成" })).toBeVisible();
      const componentsTable = page.locator("table").filter({ hasText: "PRD001" });
      await expect(componentsTable).toBeVisible();
    });

    test("管理者がセット商品を削除できる", async ({ page }) => {
      await page.goto(`/products/${TEST_SET_CODE}`);
      await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();

      await page.getByRole("button", { name: "削除" }).click();

      await expect(page).toHaveURL(/\/products/, { timeout: 10000 });
      await expect(page.getByText("商品を削除しました。")).toBeVisible({ timeout: 10000 });
    });
  });

  test("重複する商品コードでエラーが表示される", async ({ page }) => {
    await page.goto("/products/new");

    await page.getByLabel("商品コード").fill("PRD001");
    await page.getByLabel("商品名").fill("重複テスト商品");
    await page.getByLabel("商品区分").selectOption("INDIVIDUAL");
    await page.getByLabel("単位").selectOption("UNIT");

    await page.getByRole("button", { name: "登録" }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/products\/new/);
  });

  test("重複する商品名でエラーが表示される", async ({ page }) => {
    await page.goto("/products/new");

    await page.getByLabel("商品コード").fill("PRDDUP");
    await page.getByLabel("商品名").fill("標準デスク");
    await page.getByLabel("商品区分").selectOption("INDIVIDUAL");
    await page.getByLabel("単位").selectOption("UNIT");

    await page.getByRole("button", { name: "登録" }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/products\/new/);
  });

  test("存在しない商品コードで404が表示される", async ({ page }) => {
    const response = await page.goto("/products/NONEXIST");
    expect(response?.status()).toBe(404);
  });
});

test.describe("商品（一般ユーザー）", () => {
  test.use({ storageState: "playwright/.auth/user.json" });

  test("一般ユーザーは商品詳細を閲覧できるが編集ボタンが見えない", async ({ page }) => {
    await page.goto("/products/PRD001");

    await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();
    await expect(page.getByText("PRD001")).toBeVisible();
    await expect(page.getByText("標準デスク")).toBeVisible();

    // 管理者用ボタンが見えない
    await expect(page.getByRole("link", { name: "編集" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "無効化" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "削除" })).not.toBeVisible();
  });

  test("一般ユーザーは編集画面にアクセスできない", async ({ page }) => {
    await page.goto("/products/PRD001/edit");

    // 非管理者は詳細ページにリダイレクトされる
    await expect(page).toHaveURL(/\/products\/PRD001$/, { timeout: 10000 });
  });
});
