import { type Page, expect, test } from "@playwright/test";

const TEST_PARENT_CODE = "PRD800";
const TEST_RELATION_A_CODE = "PRD801";
const TEST_RELATION_B_CODE = "PRD802";

async function createProduct(
  page: Page,
  code: string,
  name: string,
  category: string,
  unit: string
) {
  await page.goto("/products/new");
  await expect(page.getByRole("heading", { name: "新規商品登録" })).toBeVisible();
  await page.getByLabel("商品コード").fill(code);
  await page.getByLabel("商品名").fill(name);
  await page.getByLabel("商品区分").selectOption(category);
  await page.getByLabel("単位").selectOption(unit);
  await page.getByRole("button", { name: "登録" }).click();
  await expect(page.getByText("商品を登録しました。")).toBeVisible({ timeout: 10000 });
}

test.describe("周辺商品モーダルテスト（管理者）", () => {
  test.describe.serial("周辺商品の追加・編集・削除", () => {
    test("テスト用の個別商品を作成する (PRD800)", async ({ page }) => {
      await createProduct(page, TEST_PARENT_CODE, "E2E周辺テスト親商品", "INDIVIDUAL", "UNIT");
    });

    test("テスト用の個別商品を作成する (PRD801)", async ({ page }) => {
      await createProduct(page, TEST_RELATION_A_CODE, "E2E周辺テスト商品A", "INDIVIDUAL", "UNIT");
    });

    test("テスト用の消耗品を作成する (PRD802)", async ({ page }) => {
      await createProduct(
        page,
        TEST_RELATION_B_CODE,
        "E2E周辺テスト消耗品B",
        "CONSUMABLE",
        "PIECE"
      );
    });

    test("周辺商品の初期状態が正しい", async ({ page }) => {
      await page.goto(`/products/${TEST_PARENT_CODE}/relations`);
      await expect(page.getByRole("heading", { name: "周辺商品設定" })).toBeVisible();
      await expect(page.getByText("周辺商品が設定されていません")).toBeVisible();

      // モーダルを開いて初期状態を確認
      await page.getByRole("button", { name: "商品を追加" }).click();
      await expect(page.getByRole("heading", { name: "商品を選択" })).toBeVisible();
      await expect(page.getByText("検索条件を入力して検索してください")).toBeVisible();
      await expect(page.getByRole("button", { name: "0件を追加" })).toBeDisabled();

      // キャンセルでモーダルが閉じる
      await page.getByRole("button", { name: "キャンセル" }).click();
      await expect(page.getByRole("heading", { name: "商品を選択" })).not.toBeVisible();
    });

    test("商品コードで検索して商品を選択・追加・保存できる", async ({ page }) => {
      await page.goto(`/products/${TEST_PARENT_CODE}/relations`);
      await page.getByRole("button", { name: "商品を追加" }).click();
      const modal = page.locator("div.fixed.inset-0");

      // PRD801をコード検索
      await page.locator("#modal-search-code").fill(TEST_RELATION_A_CODE);
      await page.getByRole("button", { name: "検索" }).click();

      // 検索結果にPRD801が表示される
      const row = modal.locator("tr", { hasText: TEST_RELATION_A_CODE });
      await expect(row).toBeVisible();
      await expect(row.getByText("E2E周辺テスト商品A")).toBeVisible();

      // 自分自身(PRD800)はモーダル内に表示されない
      await expect(modal.locator("tr", { hasText: TEST_PARENT_CODE })).not.toBeVisible();

      // チェックして追加
      await row.locator("input[type='checkbox']").click();
      await expect(page.getByRole("button", { name: "1件を追加" })).toBeEnabled();
      await page.getByRole("button", { name: "1件を追加" }).click();

      // モーダルが閉じてテーブルに追加される
      await expect(page.getByRole("heading", { name: "商品を選択" })).not.toBeVisible();
      const relRow = page.locator("table tr", { hasText: TEST_RELATION_A_CODE });
      await expect(relRow).toBeVisible();
      await expect(relRow.locator("input[type='number']")).toHaveValue("1");

      // 保存して永続化
      await page.getByRole("button", { name: "保存" }).click();
      await expect(page).toHaveURL(new RegExp(`/products/${TEST_PARENT_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品情報を更新しました。")).toBeVisible({ timeout: 10000 });
    });

    test("追加済み商品が除外された状態で別の商品を追加できる", async ({ page }) => {
      await page.goto(`/products/${TEST_PARENT_CODE}/relations`);

      // PRD801が永続化されていることを確認
      await expect(page.locator("table tr", { hasText: TEST_RELATION_A_CODE })).toBeVisible();

      await page.getByRole("button", { name: "商品を追加" }).click();
      const modal = page.locator("div.fixed.inset-0");

      // 名前検索+区分フィルターでPRD802を検索
      await page.locator("#modal-search-name").fill("E2E周辺テスト");
      await page.locator("#modal-search-category").selectOption("CONSUMABLE");
      await page.getByRole("button", { name: "検索" }).click();

      // モーダル内でPRD802のみ表示される（PRD801は追加済みで除外、PRD800は自身で除外）
      const row = modal.locator("tr", { hasText: TEST_RELATION_B_CODE });
      await expect(row).toBeVisible();
      await expect(modal.locator("tr", { hasText: TEST_RELATION_A_CODE })).not.toBeVisible();
      await expect(modal.locator("tr", { hasText: TEST_PARENT_CODE })).not.toBeVisible();

      await row.locator("input[type='checkbox']").click();
      await page.getByRole("button", { name: "1件を追加" }).click();

      // 両方の商品がテーブルに表示される
      await expect(page.locator("table tr", { hasText: TEST_RELATION_A_CODE })).toBeVisible();
      await expect(page.locator("table tr", { hasText: TEST_RELATION_B_CODE })).toBeVisible();

      // 保存して永続化
      await page.getByRole("button", { name: "保存" }).click();
      await expect(page).toHaveURL(new RegExp(`/products/${TEST_PARENT_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品情報を更新しました。")).toBeVisible({ timeout: 10000 });
    });

    test("全追加済み商品がモーダルから除外される", async ({ page }) => {
      await page.goto(`/products/${TEST_PARENT_CODE}/relations`);
      await page.getByRole("button", { name: "商品を追加" }).click();

      // PRD80で検索すると、自身(800)と追加済み(801,802)はすべて除外される
      await page.locator("#modal-search-code").fill("PRD80");
      await page.getByRole("button", { name: "検索" }).click();

      await expect(page.getByText("該当する商品が見つかりません")).toBeVisible();

      await page.getByRole("button", { name: "キャンセル" }).click();
    });

    test("数量を変更して保存できる", async ({ page }) => {
      await page.goto(`/products/${TEST_PARENT_CODE}/relations`);

      // PRD801の数量を3に変更
      const quantityInput = page
        .locator("tr", { hasText: TEST_RELATION_A_CODE })
        .locator("input[type='number']");
      await quantityInput.clear();
      await quantityInput.fill("3");

      await page.getByRole("button", { name: "保存" }).click();
      await expect(page).toHaveURL(new RegExp(`/products/${TEST_PARENT_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品情報を更新しました。")).toBeVisible({ timeout: 10000 });

      // 永続化を確認
      await page.goto(`/products/${TEST_PARENT_CODE}/relations`);
      await expect(
        page.locator("tr", { hasText: TEST_RELATION_A_CODE }).locator("input[type='number']")
      ).toHaveValue("3");
    });

    test("周辺商品を個別に削除できる", async ({ page }) => {
      await page.goto(`/products/${TEST_PARENT_CODE}/relations`);

      // PRD801を削除
      await page
        .locator("tr", { hasText: TEST_RELATION_A_CODE })
        .getByRole("button", { name: "削除" })
        .click();
      await expect(page.locator("tr", { hasText: TEST_RELATION_A_CODE })).not.toBeVisible();
      await expect(page.locator("tr", { hasText: TEST_RELATION_B_CODE })).toBeVisible();

      // PRD802を削除
      await page
        .locator("tr", { hasText: TEST_RELATION_B_CODE })
        .getByRole("button", { name: "削除" })
        .click();
      await expect(page.getByText("周辺商品が設定されていません")).toBeVisible();

      // 保存
      await page.getByRole("button", { name: "保存" }).click();
      await expect(page).toHaveURL(new RegExp(`/products/${TEST_PARENT_CODE}`), {
        timeout: 10000,
      });
      await expect(page.getByText("商品情報を更新しました。")).toBeVisible({ timeout: 10000 });
    });
  });
});
