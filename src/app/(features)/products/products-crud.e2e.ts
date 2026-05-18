import { expect, test } from "@playwright/test";

/** §9 chain1（ライフサイクル）用: 作成→詳細→更新→削除 */
const TEST_INDIVIDUAL_CODE = "PRD901";
/** セット商品 chain 用（個別商品とはデータ区分が異なるため独立 chain・§4） */
const TEST_SET_CODE = "PRD902";
/** §9 chain2（ステータス管理）用: ライフサイクルとは別データコード */
const TEST_STATUS_CODE = "PRD903";

test.describe("商品CRUD（管理者）", () => {
  // §9 chain1: 作成 → 詳細確認 → 更新 → 削除（1 ライフサイクル × 1 関心事）
  test.describe.serial("ライフサイクル - 個別商品", () => {
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

      // ラベル→値のペアで検証（dt + dd 構造を活用）
      const field = (label: string) => page.locator("dt", { hasText: label }).locator("+ dd");

      await expect(field("商品コード")).toContainText(TEST_INDIVIDUAL_CODE);
      await expect(field("商品名")).toContainText("E2Eテスト個別商品");
      await expect(field("商品区分")).toContainText("個別商品");
      await expect(field("単位")).toContainText("台");
      await expect(field("状態")).toContainText("有効");
      await expect(field("原価")).toContainText("10,000円");
      await expect(field("商品説明")).toContainText("E2Eテスト用の個別商品です");

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

    test("管理者が商品を削除できる", async ({ page }) => {
      await page.goto(`/products/${TEST_INDIVIDUAL_CODE}`);
      await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();

      await page.getByRole("button", { name: "削除" }).click();

      await expect(page).toHaveURL(/\/products/, { timeout: 10000 });
      await expect(page.getByText("商品を削除しました。")).toBeVisible({ timeout: 10000 });
    });
  });

  // §9 chain2: 作成 → 無効化 → 有効化 → 削除（ステータス管理は独立 chain・§4）
  test.describe.serial("ステータス管理 - 個別商品", () => {
    test("管理者がステータス管理用の個別商品を作成できる", async ({ page }) => {
      await page.goto("/products/new");
      await expect(page.getByRole("heading", { name: "新規商品登録" })).toBeVisible();

      await page.getByLabel("商品コード").fill(TEST_STATUS_CODE);
      await page.getByLabel("商品名").fill("E2Eステータス管理商品");
      await page.getByLabel("商品区分").selectOption("INDIVIDUAL");
      await page.getByLabel("単位").selectOption("UNIT");
      await page.getByLabel("原価").fill("5000");

      await page.getByRole("button", { name: "登録" }).click();

      await expect(page).toHaveURL(/\/products/, { timeout: 10000 });
      await page.waitForLoadState("load");
      await expect(page.getByText("商品を登録しました。")).toBeVisible({ timeout: 10000 });
    });

    test("管理者が商品を無効化できる", async ({ page }) => {
      await page.goto(`/products/${TEST_STATUS_CODE}`);
      await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();

      await page.getByRole("button", { name: "無効化" }).click();

      await expect(page).toHaveURL(new RegExp(`/products/${TEST_STATUS_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品を無効化しました。")).toBeVisible({ timeout: 10000 });
      const statusField = page.locator("dt", { hasText: "状態" }).locator("+ dd");
      await expect(statusField).toContainText("無効");
    });

    test("管理者が商品を有効化できる", async ({ page }) => {
      await page.goto(`/products/${TEST_STATUS_CODE}`);
      await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();

      await page.getByRole("button", { name: "有効化" }).click();

      await expect(page).toHaveURL(new RegExp(`/products/${TEST_STATUS_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品を有効化しました。")).toBeVisible({ timeout: 10000 });
    });

    test("管理者がステータス管理用の商品を削除できる", async ({ page }) => {
      await page.goto(`/products/${TEST_STATUS_CODE}`);
      await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible();

      await page.getByRole("button", { name: "削除" }).click();

      await expect(page).toHaveURL(/\/products/, { timeout: 10000 });
      await expect(page.getByText("商品を削除しました。")).toBeVisible({ timeout: 10000 });
    });
  });

  // セット商品は個別商品とデータ区分が異なるため独立 chain（§4）
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

// SKILL §11: 商品は権限差異あり機能（編集・無効化・削除・新規登録リンクが管理者限定）。
// createProduct server action が verifyAdmin() を必須とし一般ユーザーは商品を作成できないため、
// 一般ユーザー簡易 chain（作成→削除）は適用不可。employees-crud.e2e.ts の前例に準拠して省略する。
// 本ブロックは権限エラーテスト（必須）と閲覧専用挙動の検証に絞る。
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

  test("一般ユーザーは商品を作成できない（サーバ認可で拒否）", async ({ page }) => {
    // /products/new は proxy 非保護のためフォーム自体は描画されるが、
    // createProduct server action の verifyAdmin() が submit 時に拒否する。
    await page.goto("/products/new");
    await expect(page.getByRole("heading", { name: "新規商品登録" })).toBeVisible();

    await page.getByLabel("商品コード").fill("PRD904");
    await page.getByLabel("商品名").fill("E2E権限テスト商品");
    await page.getByLabel("商品区分").selectOption("INDIVIDUAL");
    await page.getByLabel("単位").selectOption("UNIT");

    await page.getByRole("button", { name: "登録" }).click();

    // サーバ側認可で FORBIDDEN リダイレクト → サインインへ排除される
    // （?reason=forbidden は redirect-reason-toast が即座に URL から除去するため、
    //   消えない回帰シグナルである権限エラートーストで検証する）
    await expect(page).toHaveURL(/\/signin/, { timeout: 10000 });
    await expect(page.getByText("この操作を行う権限がありません。")).toBeVisible({
      timeout: 10000,
    });
  });
});
