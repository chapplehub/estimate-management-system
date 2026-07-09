import { expect, test, type Page } from "@playwright/test";

/**
 * 見積明細の販売単価 解決不能ケース（#430・ADR-0064）の E2E。
 *
 * #430 で明細生成は価格決定（ResolveSellingPriceQuery）に接続され、単価はサーバがマスタから
 * 権威解決する。見積年月日で有効な販売単価が無い商品は 0 円明細を作らず、明細追加そのものを
 * 拒否してエラー文言を出す（FE は表示時点でも同じ解決を行い、解決不能なら行を足さない）。
 *
 * 決定的な解決不能商品として PRD830（seed-e2e・有効・選択可だが共通/得意先/納品先いずれの販売単価も
 * 未投入）を使う。C1 新規作成の明細追加動線で検証する（作成フォームも共有の VariationLineEditor＝
 * 選択エラーバナーを描画する）。
 */

/** 得意先（山田製作所）と納品先（東京倉庫）をモーダルで選ぶ（create 動線と同型）。 */
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

test.describe("見積明細の販売単価 解決不能（C1・#430）", () => {
  test("有効な販売単価が無い商品は明細に追加できずエラーが出る（ADR-0064）", async ({ page }) => {
    await page.goto("/estimates/new");

    await selectCustomerAndDelivery(page);
    await page.getByLabel("部署").selectOption({ label: "営業部" });

    // 有効単価の無い商品（PRD830）を選ぶ。
    await page.getByRole("button", { name: "明細追加" }).click();
    await page.locator("#modal-search-name").fill("販売単価なし");
    await page.getByRole("button", { name: "検索" }).click();
    await page
      .getByRole("row", { name: /販売単価なし_解決不能テスト商品/ })
      .getByRole("checkbox")
      .click();
    await page.getByRole("button", { name: /件を追加/ }).click();

    // 0 円明細を作らず追加拒否し、エラー文言を出す（価格決定が解決不能）。
    await expect(page.getByText(/有効な販売単価が設定されていない/)).toBeVisible();
    // 行は追加されない（明細削除ボタンが現れない＝作業コピーに乗っていない）。
    await expect(
      page.getByRole("button", { name: /明細を削除（販売単価なし_解決不能テスト商品）/ })
    ).toHaveCount(0);
  });
});
