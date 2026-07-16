import { expect, test, type Page } from "@playwright/test";

/**
 * 見積明細の販売単価 解決不能ケース（#430・ADR-0064）の E2E。
 *
 * #430 で明細生成は価格決定（ResolveSellingPriceQuery）に接続され、単価はサーバがマスタから
 * 権威解決する。見積年月日で有効な販売単価が無い商品は 0 円明細を作らず、明細追加そのものを
 * 拒否する（FE は表示時点でも同じ解決を行い、解決不能なら行を足さない）。
 *
 * #618 で複数選択に対応し、拒否は**モーダルを閉じずモーダル内に**表示する形へ変わった
 * （ADR-20260716-r4d）。1件でも解決不能なら1件も追加しない原子的拒否で、ユーザーは原因商品の
 * チェックを外すだけで再確定できる。原因行の可視化は `data-invalid` を継ぎ目に検証する（配色クラスは
 * 見た目の変更で割れるため assert しない）。
 *
 * 決定的な解決不能商品として PRD830（seed-e2e・有効・選択可だが共通/得意先/納品先いずれの販売単価も
 * 未投入）を、解決可能な対照として PRD811（共通販売単価 2000 を投入済み）を使う。両者は商品コードの
 * 部分一致検索 "PRD8" で同一の検索結果に並ぶため、1回の検索で混在選択を作れる。C1 新規作成の明細追加
 * 動線で検証する（作成フォームも共有の VariationLineEditor を使う）。
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
  test("解決不能な商品が混ざると1件も追加せずモーダル内で拒否し、外せば再確定できる（ADR-0064・#618）", async ({
    page,
  }) => {
    await page.goto("/estimates/new");

    await selectCustomerAndDelivery(page);
    await page.getByLabel("部署").selectOption({ label: "営業部" });

    // 有効単価あり（PRD811）と無し（PRD830）を1回の検索結果から同時に選ぶ。
    await page.getByRole("button", { name: "明細追加" }).click();
    await page.locator("#modal-search-code").fill("PRD8");
    await page.getByRole("button", { name: "検索" }).click();
    const resolvableRow = page.getByRole("row", { name: /S4周辺テスト周辺/ });
    const unresolvableRow = page.getByRole("row", { name: /販売単価なし_解決不能テスト商品/ });
    await resolvableRow.getByRole("checkbox").click();
    await unresolvableRow.getByRole("checkbox").click();
    await page.getByRole("button", { name: /件を追加/ }).click();

    // 0 円明細を作らず拒否し、モーダルは閉じずに理由を中に出す（価格決定が解決不能）。
    // 拒否の alert は固定の文言で引く（Next.js のルートアナウンサーも role="alert" のため）。
    const rejectionAlert = page.getByRole("alert").filter({ hasText: "有効な販売単価が無いため" });
    await expect(rejectionAlert).toContainText("販売単価なし_解決不能テスト商品");
    await expect(page.locator("#modal-search-code")).toBeVisible();
    // 原因行だけがハイライトされ、どれを外せばよいかが分かる。
    await expect(unresolvableRow).toHaveAttribute("data-invalid", "true");
    await expect(resolvableRow).not.toHaveAttribute("data-invalid", "true");
    // 原子的拒否: 解決できた PRD811 すら追加されない（明細削除ボタンが現れない＝作業コピーに乗っていない）。
    await expect(page.getByRole("button", { name: /明細を削除（S4周辺テスト周辺）/ })).toHaveCount(
      0
    );
    await expect(
      page.getByRole("button", { name: /明細を削除（販売単価なし_解決不能テスト商品）/ })
    ).toHaveCount(0);

    // 原因商品のチェックを外すだけで再確定でき、残りの1件が明細に乗る（拒否経路の目的そのもの）。
    await unresolvableRow.getByRole("checkbox").click();
    await page.getByRole("button", { name: /件を追加/ }).click();
    await expect(page.locator("#modal-search-code")).toBeHidden();
    await expect(page.getByRole("button", { name: /明細を削除（S4周辺テスト周辺）/ })).toHaveCount(
      1
    );
  });
});
