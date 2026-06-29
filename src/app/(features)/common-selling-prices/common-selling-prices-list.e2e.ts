import { type Page, expect, test } from "@playwright/test";

/**
 * 共通販売単価 一覧（UC-1）の E2E。
 *
 * 母集合は全商品。商品ごとに参照日（今日）で有効な共通販売単価を1件添えて一覧化する
 * （CommonSellingPriceListQueryService）。状態は ¥表示（現在有効）/「未設定」/「失効中」の3値で、
 * シードの PRD820(現在有効)・PRD821(未設定)・PRD823(失効) に対応する（ADR-20260629-3x5）。
 * 並列・共通シード（DB 不変）。状態の time-dependence は today 相対シードで決定的に再現する。
 */

/** 一覧のハイドレーション完了を待つ（SearchForm の onSubmit が効く状態）。 */
async function waitForListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "共通販売単価一覧" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

/** ヘッダー名からカラム位置（1始まり）を取得する（ADR-0017・列順に依存しないセル特定）。 */
async function getColumnIndex(page: Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}

test.describe("共通販売単価一覧（UC-1）", () => {
  test("一覧が表示される", async ({ page }) => {
    await page.goto("/common-selling-prices");
    await waitForListReady(page);

    // H1（画面タイトル）と H2（一覧見出し）。H1 は substring 一致を避けるため exact 指定。
    await expect(page.getByRole("heading", { name: "共通販売単価", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "共通販売単価一覧" })).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("商品コードで部分一致検索できる", async ({ page }) => {
    await page.goto("/common-selling-prices");
    await waitForListReady(page);

    await page.getByLabel("商品コード").fill("PRD820");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/code=PRD820/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD820" })).toBeVisible();
  });

  test("商品名で部分一致検索できる", async ({ page }) => {
    await page.goto("/common-selling-prices");
    await waitForListReady(page);

    await page.getByLabel("商品名").fill("CSP_3状態");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/name=/, { timeout: 10000 });
    await expect(page.getByText("CSP_3状態テスト商品")).toBeVisible();
  });

  test("状態に応じて現在有効単価／未設定／失効中が表示される", async ({ page }) => {
    // 現在有効（PRD820）: ¥2,000 を金額表示
    await page.goto("/common-selling-prices?code=PRD820");
    await waitForListReady(page);
    const priceCol = await getColumnIndex(page, "現在有効単価");
    await expect(page.locator(`table tbody tr td:nth-child(${priceCol})`).first()).toHaveText(
      "¥2,000"
    );

    // 未設定（PRD821）: 「未設定」バッジ
    await page.goto("/common-selling-prices?code=PRD821");
    await waitForListReady(page);
    await expect(page.locator(`table tbody tr td:nth-child(${priceCol})`).first()).toHaveText(
      "未設定"
    );

    // 失効（PRD823）: 「失効中」バッジ
    await page.goto("/common-selling-prices?code=PRD823");
    await waitForListReady(page);
    await expect(page.locator(`table tbody tr td:nth-child(${priceCol})`).first()).toHaveText(
      "失効中"
    );
  });

  test("「未設定のみ」で絞り込める", async ({ page }) => {
    // PRD82x 帯に絞り、さらに未設定のみ。PRD821/822/824 が残り、PRD820(現在有効) は除外される。
    await page.goto("/common-selling-prices");
    await waitForListReady(page);

    await page.getByLabel("商品コード").fill("PRD82");
    await page.getByLabel("絞り込み").selectOption("unset");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/filter=unset/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD821" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PRD820" })).not.toBeVisible();

    // 表示されている現在有効単価セルがすべて「未設定」であること（絞り込みの意味を検証）。
    const priceCol = await getColumnIndex(page, "現在有効単価");
    const cells = page.locator(`table tbody tr td:nth-child(${priceCol}) span`);
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(cells.nth(i)).toHaveText("未設定");
    }
  });

  test("商品コードリンクから詳細へ遷移できる", async ({ page }) => {
    await page.goto("/common-selling-prices?code=PRD820");
    await waitForListReady(page);

    await page.getByRole("link", { name: "PRD820" }).click();

    await expect(page).toHaveURL(/\/common-selling-prices\/PRD820$/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "共通販売単価", exact: true })).toBeVisible();
  });
});
