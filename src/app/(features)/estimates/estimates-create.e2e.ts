import { expect, test, type Page } from "@playwright/test";

/**
 * 見積新規作成画面 S1（C1）の E2E。seed-e2e の決定的マスタ（得意先・納品先・部署・商品・税率
 * 8%/10% 境界）に対し、(1) NEW 作成→詳細遷移、(2) 自動展開セット群を含む作成、(3) 区分別情報
 * （修理）入力での作成、(4) §8.7 税率不一致のフォーム警告を検証する（ADR-0017/0020）。
 *
 * 単一フォーム＋単一アクションで原子的に作成し、成功時は詳細画面へ遷移する。作成系のため各テストは
 * 独立に1見積を作る（採番は再シードで決定的・厳密な採番値は assert しない）。
 */

/** 得意先（山田製作所）と納品先（東京倉庫）をモーダルで選ぶ。 */
async function selectCustomerAndDelivery(page: Page) {
  await page.getByRole("button", { name: "得意先を選択" }).click();
  await page.getByLabel("名称").fill("山田製作所");
  await page.getByRole("button", { name: "検索" }).click();
  await page
    .getByRole("row", { name: /株式会社山田製作所/ })
    .getByRole("checkbox")
    .click();
  await page.getByRole("button", { name: /件を追加/ }).click();

  await page.getByRole("button", { name: "納品先を選択" }).click();
  await page.getByLabel("名称").fill("東京倉庫");
  await page.getByRole("button", { name: "検索" }).click();
  await page
    .getByRole("row", { name: /山田製作所 東京倉庫/ })
    .getByRole("checkbox")
    .click();
  await page.getByRole("button", { name: /件を追加/ }).click();
}

/** 明細追加モーダルで指定商品を選ぶ。 */
async function addProductLine(page: Page, productName: string) {
  await page.getByRole("button", { name: "明細追加" }).click();
  await page.locator("#modal-search-name").fill(productName);
  await page.getByRole("button", { name: "検索" }).click();
  await page
    .getByRole("row", { name: new RegExp(productName) })
    .getByRole("checkbox")
    .click();
  await page.getByRole("button", { name: /件を追加/ }).click();
}

test.describe("見積新規作成（C1）", () => {
  test("NEW を作成すると詳細画面へ遷移し登録トーストが出る", async ({ page }) => {
    await page.goto("/estimates/new");

    await selectCustomerAndDelivery(page);
    await page.getByLabel("部署").selectOption({ label: "営業部" });
    await addProductLine(page, "標準デスク");

    await page.getByRole("button", { name: "作成", exact: true }).click();

    await expect(page.getByText("見積を登録しました。")).toBeVisible();
    // 詳細画面（閲覧）へ遷移し、選んだ得意先が反映される。
    await expect(page).toHaveURL(/\/estimates\/[A-Za-z0-9]+/);
    await expect(page.getByText(/株式会社山田製作所/)).toBeVisible();
  });

  test("セット商品を選ぶと構成が自動展開され、その見積を作成できる", async ({ page }) => {
    await page.goto("/estimates/new");

    await selectCustomerAndDelivery(page);
    await page.getByLabel("部署").selectOption({ label: "営業部" });

    // セット商品（デスクセット一式）→ 構成（標準デスク・オフィスチェア）が自動展開される。
    await addProductLine(page, "デスクセット一式");
    await expect(page.getByRole("button", { name: "明細を削除（標準デスク）" })).toBeVisible();
    await expect(page.getByRole("button", { name: "明細を削除（オフィスチェア）" })).toBeVisible();

    await page.getByRole("button", { name: "作成", exact: true }).click();

    await expect(page.getByText("見積を登録しました。")).toBeVisible();
    await expect(page.locator("table tbody tr", { hasText: "標準デスク" })).toBeVisible();
    await expect(page.locator("table tbody tr", { hasText: "オフィスチェア" })).toBeVisible();
  });

  test("修理区分を選び修理情報を入力して作成できる", async ({ page }) => {
    await page.goto("/estimates/new");

    // 見積区分=修理 → 修理情報セクションが現れる。
    await page.getByLabel("見積区分").selectOption({ label: "修理" });
    await expect(page.getByText("修理情報", { exact: true })).toBeVisible();

    await selectCustomerAndDelivery(page);
    await page.getByLabel("部署").selectOption({ label: "営業部" });

    // 修理対象機器（標準デスク）・修理予定日・故障内容を埋める（区分別必須）。
    await page.getByRole("button", { name: "修理対象機器を選択" }).click();
    await page.locator("#modal-search-name").fill("標準デスク");
    await page.getByRole("button", { name: "検索" }).click();
    await page
      .getByRole("row", { name: /標準デスク/ })
      .getByRole("checkbox")
      .click();
    await page.getByRole("button", { name: /件を追加/ }).click();

    await page.getByLabel("修理予定日").fill("2026-07-01");
    await page.getByLabel("故障内容").fill("天板の歪み");

    await page.getByRole("button", { name: "作成", exact: true }).click();

    await expect(page.getByText("見積を登録しました。")).toBeVisible();
    await expect(page.getByText(/株式会社山田製作所/)).toBeVisible();
  });

  test("見積年月日と締切日で税率が異なると §8.7 警告が出て作成されない", async ({ page }) => {
    await page.goto("/estimates/new");

    await selectCustomerAndDelivery(page);
    await page.getByLabel("部署").selectOption({ label: "営業部" });

    // 8%(〜2019-09-30) と 10%(2019-10-01〜) の境界をまたぐ。
    await page.getByLabel("見積日").fill("2019-09-30");
    await page.getByLabel("締切日").fill("2019-10-01");

    await page.getByRole("button", { name: "作成", exact: true }).click();

    // 不一致は作成されずフォームエラーで提示される（詳細へは遷移しない）。
    await expect(page.getByText(/税率が異なります/)).toBeVisible();
    await expect(page).toHaveURL(/\/estimates\/new$/);
  });
});
