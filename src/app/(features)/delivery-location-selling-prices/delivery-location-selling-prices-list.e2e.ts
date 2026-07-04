import { type Page, expect, test } from "@playwright/test";

/**
 * 納品先別販売単価 一覧（#548）の E2E。
 *
 * `/delivery-location-selling-prices`（納品先未選択）は案内＋納品先セレクタのみを出し、
 * `/delivery-location-selling-prices/[deliveryLocationCd]` で選択納品先の「価格保守対象商品 ×
 * 現在有効な納品先別単価」を一覧化する（DeliveryLocationSellingPriceListQueryService・封筒型
 * DTO null → 404）。状態は ¥表示（active）/「失効中」（lapsed）/「上書きなし」（none）の3値で、
 * 共通単価を COALESCE せず並記する（納品先宛の価格解決連鎖 `納品先別 ?? 共通` をそのまま写す・#546）。
 *
 * 納品先セレクタは全納品先を1モーダルで横断検索（グローバル検索）し、同名納品先の曖昧性を候補の
 * 得意先列で解消する（得意先別 #508 の唯一の実質差）。封筒 DTO は親得意先 identity を同梱し、
 * ヘッダに納品先名・コード＋親得意先名・コードを併記する。
 *
 * シードは専用得意先 C903 × 専用納品先 DL903 × PRD87x 帯（ADR-20260629-3x5・today 相対）:
 * - PRD870: 上書き有効・有界 ¥1,800 ＋ 共通 ¥2,000
 * - PRD871: 上書き有効・無期限 ¥900 ＋ 共通なし
 * - PRD872: 上書き失効のみ ＋ 共通 ¥1,200
 * - PRD873: 上書きなし ＋ 共通 ¥1,100
 * - PRD874: 上書きなし ＋ 共通なし
 * - PRD875: 無効商品 ＋ 上書き有効 ¥700
 * 無効納品先ヘッダバッジは DL904（無効・上書きなし）への直接 URL で検証する。
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
  await expect(page.getByRole("heading", { name: "納品先別販売単価一覧" })).toBeVisible();
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

test.describe("納品先別販売単価一覧（#548）", () => {
  test("納品先未選択では案内とセレクタのみが表示される", async ({ page }) => {
    await page.goto("/delivery-location-selling-prices");

    await expect(
      page.getByRole("heading", { name: "納品先別販売単価", exact: true })
    ).toBeVisible();
    await expect(page.getByText("納品先を選択してください")).toBeVisible();
    await expect(page.getByRole("button", { name: "納品先を選択" })).toBeVisible();
    // 商品一覧テーブルは出さない（納品先なしの一覧は意味を持たない）。
    await expect(page.locator("table")).not.toBeVisible();
  });

  test("モーダルで納品先をグローバル検索・選択すると一覧へ遷移する（候補に得意先列）", async ({
    page,
  }) => {
    await page.goto("/delivery-location-selling-prices");

    await page.getByRole("button", { name: "納品先を選択" }).click();
    // 納品先名で全納品先を横断検索（得意先で拘束しない）。
    await page.getByLabel("名称").fill("納品先別単価テスト");
    await page.getByRole("button", { name: "検索" }).click();

    // 候補行に納品先名＋親得意先名が並ぶ（同名納品先の曖昧性を得意先列で解消する）。
    const row = page.getByRole("row", { name: /E2E専用_納品先別単価テスト納品先/ });
    await expect(row.getByText("E2E専用_納品先別単価テスト商事")).toBeVisible();
    await row.getByRole("checkbox").click();
    await page.getByRole("button", { name: /件を追加/ }).click();

    await expect(page).toHaveURL(/\/delivery-location-selling-prices\/DL903$/, { timeout: 10000 });
    // ヘッダに納品先名・コード＋親得意先名・コードを併記する。
    await expect(page.getByText("E2E専用_納品先別単価テスト納品先（DL903）")).toBeVisible();
    await expect(page.getByText("E2E専用_納品先別単価テスト商事（C903）")).toBeVisible();
  });

  test("状態に応じて金額／失効中／上書きなしが表示され共通単価が並記される", async ({ page }) => {
    // PRD87x 帯に商品名で絞り込み、3状態＋共通単価並記を1画面で確認する。
    await page.goto("/delivery-location-selling-prices/DL903?name=納品先単価");
    await waitForListReady(page);

    const priceCol = await getColumnIndex(page, "納品先別単価");
    const commonCol = await getColumnIndex(page, "共通単価");

    // active（PRD870）: 上書き ¥1,800・共通 ¥2,000 の並記（COALESCE しない）。
    await expect(cellOf(page, "PRD870", priceCol)).toHaveText("¥1,800");
    await expect(cellOf(page, "PRD870", commonCol)).toHaveText("¥2,000");

    // active・共通なし（PRD871）: 上書き ¥900・共通列は空欄。
    await expect(cellOf(page, "PRD871", priceCol)).toHaveText("¥900");
    await expect(cellOf(page, "PRD871", commonCol)).toHaveText("");

    // lapsed（PRD872）: 「失効中」バッジ。共通は生きているので ¥1,200 が読める。
    await expect(cellOf(page, "PRD872", priceCol)).toHaveText("失効中");
    await expect(cellOf(page, "PRD872", commonCol)).toHaveText("¥1,200");

    // none（PRD873）: 「上書きなし」バッジ＋共通 ¥1,100（既定価格が読める）。
    await expect(cellOf(page, "PRD873", priceCol)).toHaveText("上書きなし");
    await expect(cellOf(page, "PRD873", commonCol)).toHaveText("¥1,100");

    // none・共通なし（PRD874）: 両列とも価格が無い。
    await expect(cellOf(page, "PRD874", priceCol)).toHaveText("上書きなし");
    await expect(cellOf(page, "PRD874", commonCol)).toHaveText("");
  });

  test("適用期間列に現在有効な上書き期間（有界・無期限）を表示し失効/上書きなしは空欄", async ({
    page,
  }) => {
    await page.goto("/delivery-location-selling-prices/DL903?name=納品先単価");
    await waitForListReady(page);

    const periodCol = await getColumnIndex(page, "適用期間");

    // active・有界（PRD870）: [today-30, today+30) を「開始 〜 終了」で表示（排他上端の生値・#513）。
    await expect(cellOf(page, "PRD870", periodCol)).toHaveText(
      `${jstRelativeDate(-30)} 〜 ${jstRelativeDate(30)}`
    );

    // active・無期限（PRD871）: [today-30, ∞) を「開始 〜 無期限」で表示。
    await expect(cellOf(page, "PRD871", periodCol)).toHaveText(`${jstRelativeDate(-30)} 〜 無期限`);

    // lapsed（PRD872）・none（PRD873）: 現在有効な上書き行が無いため空欄。
    await expect(cellOf(page, "PRD872", periodCol)).toHaveText("");
    await expect(cellOf(page, "PRD873", periodCol)).toHaveText("");
  });

  test("商品コードで部分一致検索できる", async ({ page }) => {
    await page.goto("/delivery-location-selling-prices/DL903");
    await waitForListReady(page);

    await page.getByLabel("商品コード").fill("PRD870");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/code=PRD870/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD870" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PRD871" })).not.toBeVisible();
  });

  test("単価状態で絞り込める（上書きなし・失効中）", async ({ page }) => {
    // PRD87x 帯に絞り、さらに上書きなしのみ。PRD873/874 が残り、active/lapsed は除外される。
    await page.goto("/delivery-location-selling-prices/DL903");
    await waitForListReady(page);

    await page.getByLabel("商品コード").fill("PRD87");
    await page.getByLabel("絞り込み").selectOption("none");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/filter=none/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD873" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PRD874" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PRD870" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "PRD872" })).not.toBeVisible();

    // 失効中のみ: PRD872 だけが残る。
    await page.getByLabel("絞り込み").selectOption("lapsed");
    await page.getByRole("button", { name: "検索" }).click();

    await expect(page).toHaveURL(/filter=lapsed/, { timeout: 10000 });
    await expect(page.getByRole("link", { name: "PRD872" })).toBeVisible();
    await expect(page.getByRole("link", { name: "PRD873" })).not.toBeVisible();
  });

  test("商品コードリンクは管理画面（#547）の URL を指す", async ({ page }) => {
    // #547 未着地の間は遷移先が一時 404 のため、リンクの宛先のみを検証する（親 #544 の順序依存）。
    await page.goto("/delivery-location-selling-prices/DL903?code=PRD870");
    await waitForListReady(page);

    await expect(page.getByRole("link", { name: "PRD870" })).toHaveAttribute(
      "href",
      "/delivery-location-selling-prices/DL903/PRD870"
    );
  });

  test("無効商品は弾かれずバッジ付きで表示される", async ({ page }) => {
    await page.goto("/delivery-location-selling-prices/DL903?code=PRD875");
    await waitForListReady(page);

    const row = page.locator("table tbody tr").first();
    await expect(row.getByText("納品先単価_無効商品テスト商品")).toBeVisible();
    await expect(row.getByText("無効", { exact: true })).toBeVisible();
    await expect(row.getByText("¥700")).toBeVisible();
  });

  test("無効納品先は弾かれずヘッダにバッジ付きで表示される", async ({ page }) => {
    // 無効納品先はセレクタ検索（有効のみ）に出ないため直接 URL で到達する。
    // 商品名で無効商品行を除外し、ページ上の「無効」バッジがヘッダのものだけになるようにする。
    await page.goto("/delivery-location-selling-prices/DL904?name=納品先単価_有効有界");
    await waitForListReady(page);

    await expect(page.getByText("E2E専用_納品先別単価テスト無効納品先（DL904）")).toBeVisible();
    await expect(page.getByText("無効", { exact: true })).toBeVisible();
  });

  test("存在しない納品先コードで404が表示される", async ({ page }) => {
    const response = await page.goto("/delivery-location-selling-prices/DL999");
    expect(response?.status()).toBe(404);
  });
});
