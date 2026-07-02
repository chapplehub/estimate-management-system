import { type Page, expect, test } from "@playwright/test";

/**
 * 原価 一覧（UC-1・#501）の E2E。
 *
 * 母集合は価格保守対象商品（個別商品・消耗品。セット商品を除く・#514）。商品ごとに参照日（今日）で有効な原価を1件添えて一覧化する
 * （CostPriceListQueryService）。状態は ¥表示（現在有効）/「未設定」/「失効中」の3値で、
 * シードの PRD840(現在有効・有界)・PRD841(現在有効・無期限)・PRD842(失効)・PRD843(未設定) に
 * 対応する（PRD84x 帯・ADR-20260629-3x5）。適用期間列は現在有効行の期間（有界=開始〜終了・
 * 無期限=開始〜無期限）を表示し、失効/未設定は空欄。並列・共通シード（DB 不変）。状態と期間の
 * time-dependence は today 相対シードで決定的に再現する。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** シードの jstRelativeDate と同じロジックで today 相対の `"YYYY-MM-DD"` を求める（突き合わせ用）。 */
function jstRelativeDate(dayOffset: number): string {
  const nowJst = new Date(Date.now() + JST_OFFSET_MS);
  const baseUtcMs = Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate());
  const shifted = new Date(baseUtcMs + dayOffset * 24 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 一覧のハイドレーション完了を待つ（SearchForm の onSubmit が効く状態）。 */
async function waitForListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "原価一覧" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

/** ヘッダー名からカラム位置（1始まり）を取得する（ADR-0017・列順に依存しないセル特定）。 */
async function getColumnIndex(page: Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}

test.describe("原価一覧（UC-1）", () => {
  test("一覧が表示される", async ({ page }) => {
    await page.goto("/cost-prices");
    await waitForListReady(page);

    // H1（画面タイトル）と H2（一覧見出し）。H1 は substring 一致を避けるため exact 指定。
    await expect(page.getByRole("heading", { name: "原価", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "原価一覧" })).toBeVisible();
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("商品コードで部分一致検索できる", async ({ page }) => {
    await page.goto("/cost-prices");
    await waitForListReady(page);

    await page.getByLabel("商品コード").fill("PRD840");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/code=PRD840/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD840" })).toBeVisible();
  });

  test("商品名で部分一致検索できる", async ({ page }) => {
    await page.goto("/cost-prices");
    await waitForListReady(page);

    await page.getByLabel("商品名").fill("COST_現在有効有界");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/name=/, { timeout: 10000 });
    await expect(page.getByText("COST_現在有効有界テスト商品")).toBeVisible();
  });

  test("状態に応じて現在有効原価／未設定／失効中が表示される", async ({ page }) => {
    // 現在有効（PRD840）: ¥1,000 を金額表示
    await page.goto("/cost-prices?code=PRD840");
    await waitForListReady(page);
    const priceCol = await getColumnIndex(page, "現在有効原価");
    await expect(page.locator(`table tbody tr td:nth-child(${priceCol})`).first()).toHaveText(
      "¥1,000"
    );

    // 未設定（PRD843）: 「未設定」バッジ
    await page.goto("/cost-prices?code=PRD843");
    await waitForListReady(page);
    await expect(page.locator(`table tbody tr td:nth-child(${priceCol})`).first()).toHaveText(
      "未設定"
    );

    // 失効（PRD842）: 「失効中」バッジ
    await page.goto("/cost-prices?code=PRD842");
    await waitForListReady(page);
    await expect(page.locator(`table tbody tr td:nth-child(${priceCol})`).first()).toHaveText(
      "失効中"
    );
  });

  test("適用期間列に現在有効行の期間（有界・無期限）を表示し失効/未設定は空欄", async ({
    page,
  }) => {
    const periodColName = "適用期間";

    // 現在有効・有界（PRD840）: [today-30, today+30) を「開始 〜 終了」で表示（排他上端の生値）。
    await page.goto("/cost-prices?code=PRD840");
    await waitForListReady(page);
    const periodCol = await getColumnIndex(page, periodColName);
    await expect(page.locator(`table tbody tr td:nth-child(${periodCol})`).first()).toHaveText(
      `${jstRelativeDate(-30)} 〜 ${jstRelativeDate(30)}`
    );

    // 現在有効・無期限（PRD841）: [today-30, ∞) を「開始 〜 無期限」で表示。
    await page.goto("/cost-prices?code=PRD841");
    await waitForListReady(page);
    await expect(page.locator(`table tbody tr td:nth-child(${periodCol})`).first()).toHaveText(
      `${jstRelativeDate(-30)} 〜 無期限`
    );

    // 失効（PRD842）: 現在有効行が無いため期間列は空欄。
    await page.goto("/cost-prices?code=PRD842");
    await waitForListReady(page);
    await expect(page.locator(`table tbody tr td:nth-child(${periodCol})`).first()).toHaveText("");

    // 未設定（PRD843）: 原価集約が無いため期間列は空欄。
    await page.goto("/cost-prices?code=PRD843");
    await waitForListReady(page);
    await expect(page.locator(`table tbody tr td:nth-child(${periodCol})`).first()).toHaveText("");
  });

  test("「未設定のみ」で絞り込める", async ({ page }) => {
    // PRD84x 帯に絞り、さらに未設定のみ。PRD843 が残り、PRD840(現在有効) は除外される。
    await page.goto("/cost-prices");
    await waitForListReady(page);

    await page.getByLabel("商品コード").fill("PRD84");
    await page.getByLabel("絞り込み").selectOption("unset");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/filter=unset/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD843" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PRD840" })).not.toBeVisible();

    // 表示されている現在有効原価セルがすべて「未設定」であること（絞り込みの意味を検証）。
    const priceCol = await getColumnIndex(page, "現在有効原価");
    const cells = page.locator(`table tbody tr td:nth-child(${priceCol}) span`);
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(cells.nth(i)).toHaveText("未設定");
    }
  });
});
