import { type Page, expect, test } from "@playwright/test";

/**
 * 得意先別販売単価 一覧（#508）の E2E。
 *
 * `/customer-selling-prices`（得意先未選択）は案内＋得意先セレクタのみを出し、
 * `/customer-selling-prices/[customerCd]` で選択得意先の「価格保守対象商品 × 現在有効な
 * 得意先別単価」を一覧化する（CustomerSellingPriceListQueryService・封筒型 DTO null → 404）。
 * 状態は ¥表示（active）/「失効中」（lapsed）/「上書きなし」（none）の3値で、共通単価を
 * COALESCE せず並記する（2段フォールバックの構造をそのまま写す・#506）。
 *
 * シードは専用得意先 C902 × PRD86x 帯（ADR-20260629-3x5・today 相対）:
 * - PRD860: 上書き有効・有界 ¥1,800 ＋ 共通 ¥2,000
 * - PRD861: 上書き有効・無期限 ¥900 ＋ 共通なし
 * - PRD862: 上書き失効のみ ＋ 共通 ¥1,200
 * - PRD863: 上書きなし ＋ 共通 ¥1,100
 * - PRD864: 上書きなし ＋ 共通なし
 * - PRD865: 無効商品 ＋ 上書き有効 ¥700
 * 無効得意先ヘッダバッジは既存 C004（無効・上書きなし）への直接 URL で検証する。
 * 閲覧のみ（DB 不変）のため直列化は不要。
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
  await expect(page.getByRole("heading", { name: "得意先別販売単価一覧" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();
}

/** ヘッダー名からカラム位置（1始まり）を取得する（ADR-0017・列順に依存しないセル特定）。 */
async function getColumnIndex(page: Page, headerName: string) {
  const headers = await page.locator("table thead th").allTextContents();
  return headers.indexOf(headerName) + 1;
}

/** 商品コードを含む行の、指定カラムのセルを引く。 */
function cellOf(page: Page, productCode: string, columnIndex: number) {
  return page
    .locator("table tbody tr", { has: page.getByRole("link", { name: productCode }) })
    .locator(`td:nth-child(${columnIndex})`);
}

test.describe("得意先別販売単価一覧（#508）", () => {
  test("得意先未選択では案内とセレクタのみが表示される", async ({ page }) => {
    await page.goto("/customer-selling-prices");

    await expect(
      page.getByRole("heading", { name: "得意先別販売単価", exact: true })
    ).toBeVisible();
    await expect(page.getByText("得意先を選択してください")).toBeVisible();
    await expect(page.getByRole("button", { name: "得意先を選択" })).toBeVisible();
    // 商品一覧テーブルは出さない（得意先なしの一覧は意味を持たない）。
    await expect(page.locator("table")).not.toBeVisible();
  });

  test("モーダルで得意先を検索・選択すると一覧へ遷移する", async ({ page }) => {
    await page.goto("/customer-selling-prices");

    await page.getByRole("button", { name: "得意先を選択" }).click();
    await page.getByLabel("名称").fill("得意先別単価テスト");
    await page.getByRole("button", { name: "検索" }).click();
    await page
      .getByRole("row", { name: /E2E専用_得意先別単価テスト商事/ })
      .getByRole("checkbox")
      .click();
    await page.getByRole("button", { name: /件を追加/ }).click();

    await expect(page).toHaveURL(/\/customer-selling-prices\/C902$/, { timeout: 10000 });
    await expect(page.getByText("E2E専用_得意先別単価テスト商事（C902）")).toBeVisible();
  });

  test("状態に応じて金額／失効中／上書きなしが表示され共通単価が並記される", async ({ page }) => {
    // PRD86x 帯に商品名で絞り込み、3状態＋共通単価並記を1画面で確認する。
    await page.goto("/customer-selling-prices/C902?name=得意先単価");
    await waitForListReady(page);

    const priceCol = await getColumnIndex(page, "得意先別単価");
    const commonCol = await getColumnIndex(page, "共通単価");

    // active（PRD860）: 上書き ¥1,800・共通 ¥2,000 の並記（COALESCE しない）。
    await expect(cellOf(page, "PRD860", priceCol)).toHaveText("¥1,800");
    await expect(cellOf(page, "PRD860", commonCol)).toHaveText("¥2,000");

    // active・共通なし（PRD861）: 上書き ¥900・共通列は空欄。
    await expect(cellOf(page, "PRD861", priceCol)).toHaveText("¥900");
    await expect(cellOf(page, "PRD861", commonCol)).toHaveText("");

    // lapsed（PRD862）: 「失効中」バッジ。共通は生きているので ¥1,200 が読める。
    await expect(cellOf(page, "PRD862", priceCol)).toHaveText("失効中");
    await expect(cellOf(page, "PRD862", commonCol)).toHaveText("¥1,200");

    // none（PRD863）: 「上書きなし」バッジ＋共通 ¥1,100（既定価格が読める）。
    await expect(cellOf(page, "PRD863", priceCol)).toHaveText("上書きなし");
    await expect(cellOf(page, "PRD863", commonCol)).toHaveText("¥1,100");

    // none・共通なし（PRD864）: 両列とも価格が無い。
    await expect(cellOf(page, "PRD864", priceCol)).toHaveText("上書きなし");
    await expect(cellOf(page, "PRD864", commonCol)).toHaveText("");
  });

  test("適用期間列に現在有効な上書き期間（有界・無期限）を表示し失効/上書きなしは空欄", async ({
    page,
  }) => {
    await page.goto("/customer-selling-prices/C902?name=得意先単価");
    await waitForListReady(page);

    const periodCol = await getColumnIndex(page, "適用期間");

    // active・有界（PRD860）: [today-30, today+30) を「開始 〜 終了」で表示（排他上端の生値・#513）。
    await expect(cellOf(page, "PRD860", periodCol)).toHaveText(
      `${jstRelativeDate(-30)} 〜 ${jstRelativeDate(30)}`
    );

    // active・無期限（PRD861）: [today-30, ∞) を「開始 〜 無期限」で表示。
    await expect(cellOf(page, "PRD861", periodCol)).toHaveText(`${jstRelativeDate(-30)} 〜 無期限`);

    // lapsed（PRD862）・none（PRD863）: 現在有効な上書き行が無いため空欄。
    await expect(cellOf(page, "PRD862", periodCol)).toHaveText("");
    await expect(cellOf(page, "PRD863", periodCol)).toHaveText("");
  });

  test("商品コードで部分一致検索できる", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902");
    await waitForListReady(page);

    await page.getByLabel("商品コード").fill("PRD860");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/code=PRD860/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD860" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PRD861" })).not.toBeVisible();
  });

  test("単価状態で絞り込める（上書きなし・失効中）", async ({ page }) => {
    // PRD86x 帯に絞り、さらに上書きなしのみ。PRD863/864 が残り、active/lapsed は除外される。
    await page.goto("/customer-selling-prices/C902");
    await waitForListReady(page);

    await page.getByLabel("商品コード").fill("PRD86");
    await page.getByLabel("絞り込み").selectOption("none");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/filter=none/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD863" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PRD864" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PRD860" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "PRD862" })).not.toBeVisible();

    // 失効中のみ: PRD862 だけが残る。
    await page.getByLabel("絞り込み").selectOption("lapsed");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/filter=lapsed/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD862" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PRD863" })).not.toBeVisible();
  });

  test("商品コードリンクから管理画面へ遷移できる", async ({ page }) => {
    // 一覧→管理画面（#507）の画面間結合を実クリックで検証する。href 一致だけでは動的ルート
    // ([customerCd]/[productCd]) の 404 を捕まえられないため、遷移先の描画まで確認する（#509 の主眼）。
    await page.goto("/customer-selling-prices/C902?code=PRD860");
    await waitForListReady(page);

    await page.getByRole("link", { name: "PRD860" }).click();

    await expect(page).toHaveURL(/\/customer-selling-prices\/C902\/PRD860$/, { timeout: 10000 });
    // 得意先・商品コンテキストを引き継いだ管理画面（適用期間パネル）が描画される。
    await expect(page.getByRole("heading", { name: "適用期間" })).toBeVisible();
    await expect(page.getByText("PRD860")).toBeVisible();
  });

  test("無効商品は弾かれずバッジ付きで表示される", async ({ page }) => {
    await page.goto("/customer-selling-prices/C902?code=PRD865");
    await waitForListReady(page);

    const row = page.locator("table tbody tr").first();
    await expect(row.getByText("得意先単価_無効商品テスト商品")).toBeVisible();
    await expect(row.getByText("無効", { exact: true })).toBeVisible();
    await expect(row.getByText("¥700")).toBeVisible();
  });

  test("無効得意先は弾かれずヘッダにバッジ付きで表示される", async ({ page }) => {
    // 無効得意先はセレクタ検索（有効のみ）に出ないため直接 URL で到達する。
    // 商品名で無効商品行を除外し、ページ上の「無効」バッジがヘッダのものだけになるようにする。
    await page.goto("/customer-selling-prices/C004?name=標準デスク");
    await waitForListReady(page);

    await expect(page.getByText("名古屋精密機器株式会社（C004）")).toBeVisible();
    await expect(page.getByText("無効", { exact: true })).toBeVisible();
  });

  test("存在しない得意先コードで404が表示される", async ({ page }) => {
    const response = await page.goto("/customer-selling-prices/C999");
    expect(response?.status()).toBe(404);
  });
});
